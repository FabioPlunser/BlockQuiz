import { auth } from '$lib/server/auth'; // path to your auth file
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { redirect, type Handle, type ResolveOptions } from '@sveltejs/kit';
import { isPublicRoute } from '$lib/server/access-policy';
import { getRequestLocale } from '$lib/server/locale';

const SECURITY_HEADERS = {
	'Content-Security-Policy': [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",
		"connect-src 'self' https://cloudflareinsights.com",
		"frame-src 'self'",
		"child-src 'self'",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'self'"
	].join('; '),
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Resource-Policy': 'same-origin',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'SAMEORIGIN'
};

function withDocumentLocale(resolve: Parameters<Handle>[0]['resolve'], locale: string) {
	return (event: Parameters<Handle>[0]['event'], options?: ResolveOptions) => {
		return resolve(event, {
			...options,
			transformPageChunk: async (input) => {
				const html = options?.transformPageChunk
					? ((await options.transformPageChunk(input)) ?? input.html)
					: input.html;
				return html.replace('%lang%', locale);
			}
		});
	};
}

export const handle: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({
		auth,
		event,
		building,
		resolve: async (innerEvent) => {
			const session = await auth.api.getSession({
				headers: innerEvent.request.headers
			});

			if (session && session.user.active !== false) {
				innerEvent.locals.session = session.session;
				innerEvent.locals.user = session.user;
			}

			if (innerEvent.locals.user && innerEvent.url.pathname === '/login') {
				redirect(303, '/');
			}

			if (!innerEvent.locals.user && !isPublicRoute(innerEvent.url.pathname)) {
				redirect(303, '/login');
			}

			const localized = withDocumentLocale(resolve, getRequestLocale(innerEvent));
			const response = await localized(innerEvent);

			for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
				response.headers.set(header, value);
			}
			return response;
		}
	});
};
