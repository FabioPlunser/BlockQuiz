import { query, form, command } from '$app/server';
import { db } from '$db/client';
import { user, account } from '$server/db/schema';
import { eq, like, and, or } from 'drizzle-orm';
import {
	userFilterSchema,
	createUpdateUserSchema,
	resetPasswordSchema
} from '$remote/schemas/usersSchema';
import { requireAuth } from '$lib/utils/requireAuth';
import { Role } from '$lib/roles';
import { error, invalid, isRedirect } from '@sveltejs/kit';
import { getRequestEvent } from '$app/server';
import { getUser, getResetToken } from '$lib/helper/dbHelper';
import { auth } from '$server/auth';
import { redirect } from '@sveltejs/kit';
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

export const updateUser = command(createUpdateUserSchema, async (data) => {
	requireAuth(Role.ADMIN);
	const { id, password, ...updates } = data;
	try {
		await db.update(user).set(updates).where(eq(user.id, id));
	} catch (e) {
		if (isRedirect(e)) {
			throw e;
		}
		error(500, 'Error updating user');
	}
});

export const createUser = form(createUpdateUserSchema, async (data) => {
	requireAuth(Role.ADMIN);
	if (!data?.email) {
		invalid('Email is required');
	}
	const existingUser = await getUser(data.email);
	if (existingUser) {
		error(500, 'User alread existst');
	}

	try {
		const hashedPassword = await Bun.password.hash(data.password);
		const userId = crypto.randomUUID();
		const now = new Date();

		await db.insert(user).values({
			id: userId,
			name: data.email,
			email: data.email,
			role: data.role,
			active: data.active,
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

		return { success: true };
	} catch (e) {
		error(500, `Creating user failed: ${JSON.stringify(e)}`);
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
		console.log(token);
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
