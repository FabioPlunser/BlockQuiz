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
import { getRequestEvent } from '$app/server';
import { getUser, getResetToken } from '$lib/helper/dbHelper';
import { auth } from '$server/auth';
import { BetterAuthError } from 'better-auth';

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
	requireAuth(Role.ADMIN);
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
	requireAuth(Role.ADMIN);
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
	const event = getRequestEvent();
	const { email, password } = data;

	try {
		const _user = await getUser(email);
		if (!_user) {
			invalid('User not found');
		}

		const result = await auth.api.requestPasswordReset({
			body: { email: _user.email }
		});

		if (!result.status) {
			invalid('Password reset failed');
		}

		const token = await getResetToken(_user.email);
		if (!token) {
			invalid('Reset token not generated');
		}

		const resetResult = await auth.api.resetPassword({
			headers: event.request.headers,
			body: { newPassword: password, token }
		});

		if (!resetResult.status) {
			invalid('Password reset failed');
		}
	} catch (e) {
		console.error(e);
		if (e instanceof BetterAuthError) {
			invalid(`Error: ${e.message}`);
		}
		throw e;
	}
});
