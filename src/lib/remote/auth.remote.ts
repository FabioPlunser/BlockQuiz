import { form, query, getRequestEvent } from '$app/server';
import { loginSchema } from '$remote/schemas/auth';
import { redirect, error, invalid } from '@sveltejs/kit';
import { auth } from '$server/auth';

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
	} catch (e: any) {
		console.error('Login error:', e);

		// Handle Better Auth specific errors
		invalid(issue.caller(e.body.message));
	}

	redirect(303, '/');
});

export const register = form(loginSchema, async (data) => {
	const event = getRequestEvent();

	try {
		const result = await auth.api.signUpEmail({
			headers: event.request.headers,
			body: { email: data.email, name: data.email, password: data.password, role: 'student' }
		});

		if (!result.user) {
			return {
				success: false,
				message: 'Registration failed'
			};
		}
	} catch (e) {
		console.error('Registration error:', e);
		return {
			success: false,
			message: 'Registration failed. Email might already be in use.'
		};
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
