import { getRequestEvent } from '$app/server';
import type { Role } from '$lib/roles';
import { redirect } from '@sveltejs/kit';

export function requireAuth(role?: Role) {
	const { locals } = getRequestEvent();

	if (!locals.user || (role && locals.user.role !== role)) {
		locals.user = undefined;
		locals.session = undefined;
		redirect(308, '/login');
	}

	return locals.user;
}
