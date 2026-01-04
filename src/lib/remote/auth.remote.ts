import { form, query, getRequestEvent, command } from '$app/server';
import { loginSchema } from '$remote/schemas/authSchema';
import { redirect, error, invalid } from '@sveltejs/kit';
import { auth } from '$server/auth';
import { BetterAuthError } from 'better-auth';
import { getResetToken, getUser } from '$lib/helper/dbHelper';
import { logger } from '$lib/logs/logger';
import { z } from 'zod';
import { db } from '$db/client';
import { user, user } from '$db/schema';
import { eq } from 'drizzle-orm';
import { tryCatch } from '$lib/utils/tryCatch';
import { resolve } from '$app/paths';

export const login = form(loginSchema, async (data, issue) => {
	const event = getRequestEvent();

	try {
		const result = await auth.api.signInEmail({
			headers: event.request.headers,
			body: { email: data.email, password: data.password }
		});

		if (!result.user) {
			logger.error('Login failed', { email: data.email });
			invalid('User already exists');
		}
		redirect(303, resolve('/(app)'));
	} catch (e) {
		if (e instanceof Error) {
			invalid(e);
		}
	}
});

export const register = form(loginSchema, async (data, issue) => {
	const event = getRequestEvent();

	try {
		const result = await auth.api.signUpEmail({
			headers: event.request.headers,
			body: { email: data.email, name: data.email, password: data.password, role: 'student' }
		});

		if (!result.user) {
			invalid('Email already in use');
		}
		redirect(303, resolve('/(app)'));
	} catch (e) {
		if (e instanceof Error) {
			console.log(e);
			invalid(e);
		}
	}
});

export const userExists = query(z.string(), async (email) => {
	try {
		await getUser(email);
		return {
			exists: true
		};
	} catch (e) {
		console.error(e);
		return {
			exists: false,
			error: 'User does not exist'
		};
	}
});

export const logoutUser = form(async () => {
	const event = getRequestEvent();

	try {
		await auth.api.signOut({
			headers: event.request.headers
		});
		event.locals.user = undefined;
		event.locals.session = undefined;
		redirect(303, resolve('/(auth)/login'));
	} catch (e) {
		if (e instanceof Error) {
			console.error(e);
		}
	}
});

export const getCurrentUser = query(async () => {
	const { locals } = getRequestEvent();
	return locals.user;
});

export const resetPassword = form(loginSchema, async (data) => {
	const { email, password } = data;

	try {
		const _user = await getUser(email);
		if (!_user) {
			invalid('User not found');
		}

		await auth.api.requestPasswordReset({
			body: { email: _user.email }
		});

		const token = await getResetToken(_user.email);
		if (!token) {
			invalid('Reset token not generated');
		}

		const resetResult = await auth.api.resetPassword({
			body: { newPassword: password, token }
		});

		if (!resetResult) {
			invalid('Password reset failed');
		}
		logger.info('Successfully reset password for ', { email: _user.email });
		redirect(303, resolve('/(auth)/login'));
	} catch (e) {
		if (e instanceof Error) {
			invalid(e);
		}
	}
});
