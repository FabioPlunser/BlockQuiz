import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { Role } from '$lib/roles';
import { env } from '$env/dynamic/private';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user || locals.user.active === false) {
		redirect(303, '/login');
	}

	return {
		isAdmin: locals.user.role === Role.ADMIN,
		authBaseUrl: env.BETTER_AUTH_URL ?? ''
	};
};
