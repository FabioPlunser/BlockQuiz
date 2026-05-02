import { form, query, getRequestEvent } from '$app/server';
import { loginSchema } from '$remote/schemas/authSchema';
import { redirect, invalid, isRedirect } from '@sveltejs/kit';
import { auth } from '$server/auth';
import { logger } from '$lib/logs/logger';

function getAuthHeaders(event: ReturnType<typeof getRequestEvent>) {
	const headers = new Headers(event.request.headers);
	headers.set('origin', event.url.origin);
	headers.set('referer', event.url.href);
	return headers;
}

export const login = form(loginSchema, async (data) => {
	const event = getRequestEvent();

	try {
		const result = await auth.api.signInEmail({
			headers: getAuthHeaders(event),
			body: { email: data.email, password: data.password }
		});

		if (!result.user) {
			logger.error('Login failed', { email: data.email });
			invalid('Invalid email or password');
		}

		if ((result.user as { active?: boolean }).active === false) {
			await auth.api.signOut({
				headers: getAuthHeaders(event)
			});
			logger.warn('Inactive user login rejected', { email: data.email });
			invalid('Invalid email or password');
		}

		redirect(303, '/courses');
	} catch (error) {
		if (isRedirect(error)) {
			throw error;
		}
		invalid('Invalid email or password');
	}
});

export const register = form(loginSchema, async (data) => {
	logger.warn('Rejected public registration request', { email: data.email });
	invalid('Registration is disabled. Please contact an administrator.');
});

export const logoutUser = form(async () => {
	const event = getRequestEvent();

	try {
		await auth.api.signOut({
			headers: getAuthHeaders(event)
		});
		event.locals.user = undefined;
		event.locals.session = undefined;
		redirect(303, '/login');
	} catch (error) {
		if (isRedirect(error)) {
			throw error;
		}

		if (error instanceof Error) {
			console.error(error);
		}
	}
});

export const getCurrentUser = query(async () => {
	const { locals } = getRequestEvent();
	return locals.user;
});

export const resetPassword = form(loginSchema, async (data) => {
	logger.warn('Rejected public password reset request', { email: data.email });
	invalid('Password reset is currently unavailable. Please contact an administrator.');
});
