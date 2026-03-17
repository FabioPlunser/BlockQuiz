import { auth } from '$lib/server/auth'; // path to your auth file
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';

const PUBLIC_ROUTE_PREFIXES = ['/login', '/test', '/demo', '/privacy', '/api/auth'];

export async function handle({ event, resolve }) {
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	// If there is a session, attach it to locals
	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	const isPublicRoute = PUBLIC_ROUTE_PREFIXES.some(
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
