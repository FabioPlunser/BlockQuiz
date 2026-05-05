export const PUBLIC_ROUTE_PREFIXES = [
	'/login',
	'/demo',
	'/privacy',
	'/api/auth',
	'/reset-password'
] as const;

export function isPublicRoute(pathname: string) {
	return PUBLIC_ROUTE_PREFIXES.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`)
	);
}
