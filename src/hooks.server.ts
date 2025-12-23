import { auth } from '$lib/server/auth'; // path to your auth file
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { logger } from '$lib/logs/logger';

export async function handle({ event, resolve }) {
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	// If there is a session, attach it to locals
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const publicRoutes = ['/login', '/test', '/demo'];

	const isPublicRoute = publicRoutes.some(
		(route) => event.url.pathname === route || event.url.pathname.startsWith(route + '/')
	);

	if (event.locals.user && event.url.pathname === '/login') {
		redirect(303, '/');
	}

	if (!event.locals.user && !isPublicRoute) {
		redirect(303, '/login');
	}

	const response = await svelteKitHandler({ event, resolve, auth, building });
	return response;
}
