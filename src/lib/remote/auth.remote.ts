import { form, query, getRequestEvent } from '$app/server';
import { loginSchema } from '$remote/schemas/authSchema';
import { redirect, error, invalid } from '@sveltejs/kit';
import { auth } from '$server/auth';
import { BetterAuthError } from 'better-auth';
import { getResetToken, getUser } from '$lib/helper/dbHelper';

export const login = form(loginSchema, async (data, issue) => {
	const event = getRequestEvent();

	try {
		const result = await auth.api.signInEmail({
			headers: event.request.headers,
			body: { email: data.email, password: data.password }
		});

		if (!result.user) {
			invalid(issue.email('User already exists'));
		}
	} catch (e) {
		if (e instanceof BetterAuthError) {
			console.error('Login error:', e);
			invalid(issue.caller(e.message));
		}
	}

	redirect(303, '/');
});

export const register = form(loginSchema, async (data, issue) => {
	const event = getRequestEvent();

	try {
		const result = await auth.api.signUpEmail({
			headers: event.request.headers,
			body: { email: data.email, name: data.email, password: data.password, role: 'student' }
		});

		if (!result.user) {
			invalid(issue.email('Email already in use'));
		}
	} catch (e) {
		invalid(issue.email('Email already in use'));
		throw e;
	}

	redirect(303, '/');
});

export const logoutUser = form(async () => {
	const event = getRequestEvent();

	try {
		await auth.api.signOut({
			headers: event.request.headers
		});
		event.locals.user = undefined;
		event.locals.session = undefined;
	} catch (e) {
		console.error('Logout failed');
	}

	redirect(303, '/');
});

export const getCurrentUser = query(async () => {
	const { locals } = getRequestEvent();
	return locals.user;
});

export const resetPassword = form(loginSchema, async (data, issue) => {
	const event = getRequestEvent();
	const { email, password } = data;

	try {
		const _user = await getUser(email);
		if (!_user) {
			invalid(issue.email('User not found'));
		}

		await auth.api.requestPasswordReset({
			body: { email: _user.email }
		});

		const token = await getResetToken(_user.email);
		if (!token) {
			invalid(issue.caller('Reset token not generated'));
		}

		const resetResult = await auth.api.resetPassword({
			headers: event.request.headers,
			body: { newPassword: password, token }
		});

		if (!resetResult.user) {
			invalid(issue.caller('Password reset failed'));
		}
	} catch (e) {
		if (e instanceof BetterAuthError) {
			invalid(issue.caller(`Error: ${e.message}`));
		}
		throw e;
	}

	redirect(303, '/');
});
