import { getRequestEvent } from '$app/server';
import { Role } from '$lib/roles';
import { error, redirect } from '@sveltejs/kit';

export function requireAuth(role?: Role) {
	const { locals } = getRequestEvent();

	if (!locals.user || locals.user.active === false || (role && locals.user.role !== role)) {
		locals.user = undefined;
		locals.session = undefined;
		redirect(308, '/login');
	}

	return locals.user;
}

/**
 * Requires the user to be authenticated and have a role that can manage course content.
 * Throws a 403 error if the user doesn't have the required permissions.
 */
export function requireTeacherOrAdmin() {
	const { locals } = getRequestEvent();

	if (!locals.user || locals.user.active === false) {
		locals.user = undefined;
		locals.session = undefined;
		redirect(308, '/login');
	}

	const userRole = locals.user.role;
	if (userRole !== Role.TEACHER && userRole !== Role.ADMIN) {
		error(403, 'Access denied. Teacher or admin role required.');
	}

	return locals.user;
}

export function isTeacherOrAdmin() {
	const { locals } = getRequestEvent();
	return locals.user && locals.user.role === Role.TEACHER || locals.user && locals.user.role === Role.ADMIN;
}

export function currentUser() {
	const { locals } = getRequestEvent();
	return locals.user ?? null;
}
	
