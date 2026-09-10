export const PUBLIC_ROUTE_PREFIXES = [
	'/login',
	'/demo',
	'/privacy',
	'/api/auth',
	'/reset-password',
	// SvelteKit remote functions live under /_app/remote/*. Each function
	// enforces its own auth (requireAuth / requireTeacherOrAdmin), so the
	// blanket login-redirect must not run here — otherwise anonymous calls
	// to public queries (e.g. getPublicCourseExercises) get redirected to
	// /login and the client sees an HTML body instead of JSON.
	'/_app/remote'
] as const;

export function isPublicRoute(pathname: string) {
	return PUBLIC_ROUTE_PREFIXES.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`)
	);
}
