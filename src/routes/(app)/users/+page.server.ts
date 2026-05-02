import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { Role } from '$lib/roles';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user || locals.user.active === false) {
		redirect(303, '/login');
	}

	if (locals.user.role !== Role.ADMIN) {
		error(403, 'Access denied. Admin role required.');
	}

	return {};
};
