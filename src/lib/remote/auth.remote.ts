import { form, query, getRequestEvent } from '$app/server';
import {
	loginSchema,
	requestPasswordResetSchema,
	completePasswordResetSchema
} from '$remote/schemas/authSchema';
import { redirect, invalid, isRedirect } from '@sveltejs/kit';
import { auth } from '$server/auth';
import { logger } from '$lib/logs/logger';
import { writeAuditLog } from '$lib/server/audit';

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

export const requestPasswordReset = form(requestPasswordResetSchema, async (data) => {
	const event = getRequestEvent();
	const redirectTo = `${event.url.origin}/reset-password`;

	try {
		await auth.api.requestPasswordReset({
			headers: getAuthHeaders(event),
			body: { email: data.email, redirectTo }
		});
	} catch (cause) {
		logger.warn('requestPasswordReset call failed', {
			email: data.email,
			cause: cause instanceof Error ? cause.message : String(cause)
		});
	}

	await writeAuditLog({
		action: 'password.reset_requested',
		category: 'user',
		details: { email: data.email }
	});

	return { success: true as const };
});

export const completePasswordReset = form(completePasswordResetSchema, async (data) => {
	const event = getRequestEvent();

	try {
		await auth.api.resetPassword({
			headers: getAuthHeaders(event),
			body: { token: data.token, newPassword: data.password }
		});
	} catch (cause) {
		logger.warn('resetPassword call failed', {
			cause: cause instanceof Error ? cause.message : String(cause)
		});
		invalid('Reset link is invalid or has expired. Please request a new one.');
	}

	await writeAuditLog({
		action: 'password.reset_completed',
		category: 'user'
	});

	return { success: true as const };
});
