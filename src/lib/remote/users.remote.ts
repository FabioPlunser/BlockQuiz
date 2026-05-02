import { query, form, command } from '$app/server';
import { db } from '$db/client';
import { user, account } from '$db/schema';
import { eq, like, and, or } from 'drizzle-orm';
import {
	userFilterSchema,
	createUserSchema,
	updateUserSchema,
	resetPasswordSchema
} from '$remote/schemas/usersSchema';
import { requireAuth } from '$lib/utils/requireAuth';
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

	return await db
		.select()
		.from(user)
		.where(and(...conditions));
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
