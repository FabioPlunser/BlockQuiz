import type { Handle } from '@sveltejs/kit';
import { validateSessionToken } from '$lib/server/auth/session';

export const handle: Handle = async ({ event, resolve }) => {
	// const sessionToken = event.cookies.get('session') ?? null;
	// if (sessionToken !== null) {
	// 	const result = await validateSessionToken(sessionToken);
	// 	event.locals.session = result.session;
	// 	event.locals.user = result.user;
	// } else {
	// 	event.locals.session = null;
	// 	event.locals.user = null;
	// }
	return resolve(event);
};