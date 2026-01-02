import { getRequestEvent } from '$app/server';
import { Role } from '$lib/roles';
import { error, redirect } from '@sveltejs/kit';

export function requireAuth(role?: Role) {
	const { locals } = getRequestEvent();

	if (!locals.user || (role && locals.user.role !== role)) {
		locals.user = undefined;
		locals.session = undefined;
		redirect(308, '/login');
	}

	return locals.user;
}

/**
 * Requires the user to be authenticated and have either Teacher or Admin role.
 * Throws a 403 error if the user doesn't have the required permissions.
 */
export function requireTeacherOrAdmin() {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		redirect(308, '/login');
	}

	const userRole = locals.user.role;
	if (userRole !== Role.TEACHER && userRole !== Role.ADMIN) {
		error(403, 'Access denied. Teacher or Admin role required.');
	}

	return locals.user;
}
