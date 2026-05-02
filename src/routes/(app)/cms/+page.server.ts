import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { Role } from '$lib/roles';

const CMS_ROLES = new Set<string>([Role.TEACHER, Role.AUTHOR, Role.ADMIN]);

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user || locals.user.active === false) {
		redirect(303, '/login');
	}

	if (!CMS_ROLES.has(locals.user.role)) {
		error(403, 'Access denied. Teacher, author, or admin role required.');
	}

	return {};
};
