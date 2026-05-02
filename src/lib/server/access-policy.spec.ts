import { describe, expect, it } from 'vitest';
import { isPublicRoute } from './access-policy';

describe('isPublicRoute', () => {
	it('allows only login, demo, privacy, and auth API routes without a session', () => {
		expect.assertions(10);

		expect(isPublicRoute('/login')).toBe(true);
		expect(isPublicRoute('/login/reset')).toBe(true);
		expect(isPublicRoute('/demo')).toBe(true);
		expect(isPublicRoute('/demo/course-1')).toBe(true);
		expect(isPublicRoute('/privacy')).toBe(true);
		expect(isPublicRoute('/api/auth/sign-in/email')).toBe(true);
		expect(isPublicRoute('/')).toBe(false);
		expect(isPublicRoute('/courses')).toBe(false);
		expect(isPublicRoute('/cms')).toBe(false);
		expect(isPublicRoute('/test')).toBe(false);
	});

	it('does not treat same-prefix sibling routes as public', () => {
		expect.assertions(3);

		expect(isPublicRoute('/login-help')).toBe(false);
		expect(isPublicRoute('/demography')).toBe(false);
		expect(isPublicRoute('/api/authentication')).toBe(false);
	});
});
