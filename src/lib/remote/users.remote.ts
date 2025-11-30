import { query, form, command } from '$app/server';
import { db } from '$server/db';
import { user, account } from '$server/db/schema';
import { eq, like, and, or } from 'drizzle-orm';
import { userFilterSchema, createUpdateUserSchema } from '$remote/schemas/users';
import { requireAuth } from '$lib/utils/requireAuth';
import { Role } from '$lib/roles';
import { error, isRedirect, } from '@sveltejs/kit';

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
	const existingUser = await db.select().from(user).where(eq(user.email, data.email)).get();
	if (existingUser) {
		error(500, 'User alread existst');
	}

	try {
		const hashedPassword = await Bun.password.hash(data.password);
		const userId = crypto.randomUUID();
		const now = new Date();

		await db.insert(user).values({
			id: userId,
			name: data.name,
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

export const resetPassword = form(createUpdateUserSchema, async (data) => {
	requireAuth(Role.ADMIN);
	const user = await db
		.select()
		.from(user)
		.where(eq(user.email, data.email))
		.get();
	if (!user) {
		error(500, 'User not found');
	}
	try {
		const hashedPassword = await Bun.password.hash(data.password);
		await db.update(account).set({ password: hashedPassword }).where(eq(account.userId, user.id));
		return { success: true };
	} catch (e) {
		error(500, `Resetting password failed: ${JSON.stringify(e)}`);
	}
});
