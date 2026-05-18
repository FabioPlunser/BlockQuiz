import { Database } from 'bun:sqlite';
import { expect, test } from '@playwright/test';

const DB_PATH = './data/e2e.sqlite';

function openDb() {
	return new Database(DB_PATH);
}

function clearProviders() {
	const db = openDb();
	db.run('DELETE FROM ssoProvider');
	db.close();
}

function insertProvider(input: { providerId: string; domain: string }) {
	const db = openDb();
	db.run(
		'INSERT INTO ssoProvider (id, issuer, providerId, domain, oidcConfig) VALUES (?, ?, ?, ?, ?)',
		[
			crypto.randomUUID(),
			'https://idp.example.com',
			input.providerId,
			input.domain,
			JSON.stringify({
				clientId: 'test-client',
				clientSecret: 'test-secret',
				authorizationEndpoint: 'https://idp.example.com/authorize',
				tokenEndpoint: 'https://idp.example.com/token',
				scopes: ['openid', 'profile', 'email']
			})
		]
	);
	try {
		db.run('PRAGMA wal_checkpoint(FULL)');
	} catch {
		// non-WAL journal, ignore
	}
	db.close();
}

test.describe('SSO login link', () => {
	test.beforeEach(() => {
		clearProviders();
	});

	test('no providers → link is not rendered', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
		await expect(page.getByRole('button', { name: /Continue with SSO/i })).toHaveCount(0);
	});

	test('one provider → single "Continue with SSO" link is visible', async ({ page }) => {
		insertProvider({ providerId: 'school-idp', domain: 'school.com' });

		await page.goto('/login');
		await expect(page.getByRole('button', { name: 'Forgot password?' })).toBeVisible();
		const ssoLink = page.getByRole('button', { name: /Continue with SSO/i });
		await expect(ssoLink).toBeVisible();
		await expect(ssoLink).toBeEnabled();
	});

	test('multiple providers → one link per provider showing domain', async ({ page }) => {
		insertProvider({ providerId: 'school-idp', domain: 'school.com' });
		insertProvider({ providerId: 'other-idp', domain: 'other.edu' });

		await page.goto('/login');
		await expect(page.getByRole('button', { name: /Continue with SSO — school\.com/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /Continue with SSO — other\.edu/i })).toBeVisible();
	});

	test('clicking the SSO link triggers a redirect attempt to the IdP', async ({ page }) => {
		insertProvider({ providerId: 'school-idp', domain: 'school.com' });

		await page.goto('/login');

		// better-auth issues a fetch to /api/auth/sign-in/sso, then redirects.
		// We intercept the redirect target so we don't actually hit a real IdP.
		const ssoRequest = page.waitForRequest(
			(req) => req.url().includes('/api/auth/sign-in/sso') && req.method() === 'POST',
			{ timeout: 5000 }
		);

		await page.getByRole('button', { name: /Continue with SSO/i }).click();

		const req = await ssoRequest;
		const body = req.postDataJSON() as { providerId?: string };
		expect(body.providerId).toBe('school-idp');
	});

	test.afterAll(() => {
		clearProviders();
	});
});
