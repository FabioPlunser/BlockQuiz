import { query, form, command, requested } from '$app/server';
import { z } from 'zod';
import { db } from '$db/client';
import { user, account, classUsers, session } from '$db/schema';
import { eq, like, and, or, inArray } from 'drizzle-orm';
import {
	userFilterSchema,
	createUserSchema,
	updateUserSchema,
	resetPasswordSchema
} from '$remote/schemas/usersSchema';
import { requireAuth, requireTeacherOrAdmin } from '$lib/utils/requireAuth';
import { Role } from '$lib/roles';
import { invalid, isRedirect } from '@sveltejs/kit';
import { getUser } from '$lib/helper/dbHelper';
import { writeAuditLog } from '$lib/server/audit';

export const getUsers = query(userFilterSchema, async (filters) => {
	requireAuth(Role.ADMIN);
	const conditions = [];

	if (filters.search) {
		conditions.push(
			or(like(user.name, `%${filters.search}%`), like(user.email, `%${filters.search}%`))
		);
	}
	if (filters.id) {
		conditions.push(eq(user.id, filters.id));
	}
	if (filters.active !== undefined) {
		conditions.push(eq(user.active, filters.active));
	}
	if (filters.email) {
		conditions.push(like(user.email, `%${filters.email}%`));
	}
	if (filters.role) {
		conditions.push(eq(user.role, filters.role));
	}

	const rows = await db
		.select()
		.from(user)
		.where(and(...conditions));

	if (rows.length === 0) return [];

	// Side-query for class memberships, grouped in JS — avoids N+1 without
	// adding an EXPR_LIST subquery to the main SELECT.
	const userIds = rows.map((r) => r.id);
	const memberships = await db
		.select({
			userId: classUsers.userId,
			classId: classUsers.classId,
			source: classUsers.source
		})
		.from(classUsers)
		.where(inArray(classUsers.userId, userIds));

	const byUser = new Map<string, { classIds: string[]; ssoClassIds: string[] }>();
	for (const m of memberships) {
		let bucket = byUser.get(m.userId);
		if (!bucket) {
			bucket = { classIds: [], ssoClassIds: [] };
			byUser.set(m.userId, bucket);
		}
		if (!bucket.classIds.includes(m.classId)) bucket.classIds.push(m.classId);
		if (m.source === 'sso' && !bucket.ssoClassIds.includes(m.classId)) {
			bucket.ssoClassIds.push(m.classId);
		}
	}

	return rows.map((r) => ({
		...r,
		classIds: byUser.get(r.id)?.classIds ?? [],
		ssoClassIds: byUser.get(r.id)?.ssoClassIds ?? []
	}));
});

/**
 * Minimal student list for the course editor's student picker. Accessible to
 * teachers/admins, returns only id + name + email + role so we don't leak
 * any admin-sensitive user fields.
 */
export const getAssignableStudents = query(async () => {
	requireTeacherOrAdmin();
	const rows = await db
		.select({ id: user.id, name: user.name, email: user.email, role: user.role })
		.from(user)
		.where(eq(user.role, Role.STUDENT));
	return rows;
});

/**
 * Authors that can own a course or exercise — teachers, authors, and admins.
 * Used by the author-reassignment dropdown in the editors. Inactive users are
 * excluded so the picker doesn't suggest deactivated accounts.
 */
export const getAssignableAuthors = query(async () => {
	requireTeacherOrAdmin();
	const rows = await db
		.select({ id: user.id, name: user.name, email: user.email, role: user.role })
		.from(user)
		.where(
			and(
				eq(user.active, true),
				or(eq(user.role, Role.TEACHER), eq(user.role, Role.ADMIN))
			)
		);
	return rows;
});

export const createUser = form(createUserSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);
	if (!data.email) {
		invalid('Email is required');
		return { success: false as const, error: 'Email is required' };
	}

	try {
		const existingUser = await getUser(data.email);
		if (existingUser) {
			invalid('User already exists');
			return { success: false as const, error: 'User already exists' };
		}
	} catch {
		// Missing user is the expected path for account creation.
	}

	try {
		const hashedPassword = await Bun.password.hash(data.password);
		const userId = crypto.randomUUID();
		const now = new Date();

		await db.insert(user).values({
			id: userId,
			name: data.email,
			email: data.email,
			role: data.role ?? Role.STUDENT,
			active: data.active ?? true,
			emailVerified: false,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(account).values({
			id: crypto.randomUUID(),
			userId: userId,
			accountId: data.email,
			providerId: 'credential',
			password: hashedPassword,
			createdAt: now,
			updatedAt: now
		});

		await writeAuditLog({
			actorUserId: actor.id,
			action: 'user.create',
			details: {
				userId,
				email: data.email,
				role: data.role ?? Role.STUDENT,
				active: data.active ?? true
			}
		});

		await requested(getUsers, 10).refreshAll();
		return { success: true as const, id: userId };
	} catch (e) {
		console.error('Error creating user:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to create user'
		};
	}
});

export const updateUser = command(updateUserSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);
	const { id, email, role, active } = data;

	try {
		await db
			.update(user)
			.set({
				email,
				role,
				active,
				updatedAt: new Date()
			})
			.where(eq(user.id, id));
		await writeAuditLog({
			actorUserId: actor.id,
			action: 'user.update',
			details: { userId: id, email, role, active }
		});

		await requested(getUsers, 10).refreshAll();
		return { success: true as const, id };
	} catch (e) {
		if (isRedirect(e)) {
			throw e;
		}
		console.error('Error updating user:', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to update user'
		};
	}
});

export const deleteUser = command(z.object({ id: z.string() }), async ({ id }) => {
	const actor = requireAuth(Role.ADMIN);

	// Pre-attempt log — every deletion attempt is recorded, even when it
	// short-circuits or fails, because this is a destructive admin action.
	await writeAuditLog({
		actorUserId: actor.id,
		action: 'user.delete.attempt',
		category: 'admin',
		details: { userId: id }
	});

	const fail = async (reason: string) => {
		await writeAuditLog({
			actorUserId: actor.id,
			action: 'user.delete.failed',
			category: 'admin',
			details: { userId: id, reason }
		});
		return { success: false as const, error: reason };
	};

	if (id === actor.id) return fail('You cannot delete your own account.');

	const [target] = await db.select().from(user).where(eq(user.id, id)).limit(1);
	if (!target) return fail('User not found');

	// Soft-delete: deactivate the user instead of dropping the row. Preserves
	// authored content (courses, exercises), audit trail, attempts history, and
	// avoids FK conflicts. Critical for IdP-managed users — we can't refuse a
	// removal that the IdP no longer recognises.
	try {
		await db.transaction(async (tx) => {
			await tx
				.update(user)
				.set({ active: false, updatedAt: new Date() })
				.where(eq(user.id, id));
			// Log the user out everywhere immediately.
			await tx.delete(session).where(eq(session.userId, id));
		});

		await writeAuditLog({
			actorUserId: actor.id,
			action: 'user.delete',
			category: 'admin',
			details: { userId: id, email: target.email, role: target.role, mode: 'soft' }
		});

		await requested(getUsers, 10).refreshAll();
		return { success: true as const, id };
	} catch (e) {
		console.error('Error deactivating user:', e);
		const message = e instanceof Error ? e.message : 'Failed to deactivate user';
		return fail(message);
	}
});

export const resetPassword = form(resetPasswordSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);
	const { email, password } = data;

	try {
		const _user = await getUser(email);
		if (!_user) {
			invalid('Password reset failed');
		}
		const hashedPassword = await Bun.password.hash(password);
		await db
			.update(account)
			.set({
				password: hashedPassword,
				updatedAt: new Date()
			})
			.where(and(eq(account.userId, _user.id), eq(account.providerId, 'credential')));
		await writeAuditLog({
			actorUserId: actor.id,
			action: 'user.reset_password',
			details: { userId: _user.id, email }
		});
	} catch (e) {
		console.error('Error resetting password:', e);
		invalid('Password reset failed');
		throw e;
	}
});
