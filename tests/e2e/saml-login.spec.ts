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

// Self-signed test certificate (not used for real validation — better-auth only
// parses it when it actually verifies a SAML response, which this suite does not).
const TEST_IDP_CERT =
	'-----BEGIN CERTIFICATE-----\nMIIBkTCB+wIJAKHHIgIIsgQ9MA0GCSqGSIb3DQEBCwUAMA8xDTALBgNVBAMMBHRl\nc3QwHhcNMjAwMTAxMDAwMDAwWhcNMzAwMTAxMDAwMDAwWjAPMQ0wCwYDVQQDDAR0\nZXN0MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDc1n/test==\n-----END CERTIFICATE-----';

function insertSamlProvider(input: { providerId: string; domain: string }) {
	const db = openDb();
	const samlConfig = JSON.stringify({
		issuer: 'https://idp.example.com/metadata',
		entryPoint: 'https://idp.example.com/sso/saml2',
		cert: TEST_IDP_CERT,
		callbackUrl: `http://localhost:4173/api/auth/sso/saml2/sp/acs/${input.providerId}`,
		audience: `http://localhost:4173/api/auth/sso/saml2/sp/metadata?providerId=${input.providerId}`,
		wantAssertionsSigned: true,
		spMetadata: {
			entityID: `http://localhost:4173/api/auth/sso/saml2/sp/metadata?providerId=${input.providerId}`
		},
		mapping: {
			email: 'email',
			name: 'displayName',
			extraFields: { groups: 'http://schemas.xmlsoap.org/claims/Group' }
		}
	});
	db.run(
		'INSERT INTO ssoProvider (id, issuer, providerId, domain, samlConfig) VALUES (?, ?, ?, ?, ?)',
		[crypto.randomUUID(), 'https://idp.example.com/metadata', input.providerId, input.domain, samlConfig]
	);
	try {
		db.run('PRAGMA wal_checkpoint(FULL)');
	} catch {
		// non-WAL journal, ignore
	}
	db.close();
}

test.describe('SAML SSO provider', () => {
	test.beforeEach(() => {
		clearProviders();
	});

	test('SAML provider surfaces on the login page like an OIDC provider', async ({ page }) => {
		insertSamlProvider({ providerId: 'school-saml', domain: 'school-saml.edu' });

		await page.goto('/login');
		const ssoLink = page.getByRole('button', { name: /Continue with SSO/i });
		await expect(ssoLink).toBeVisible();
		await expect(ssoLink).toBeEnabled();
	});

	test('clicking the SAML provider posts providerId to /api/auth/sign-in/sso', async ({
		page
	}) => {
		insertSamlProvider({ providerId: 'school-saml', domain: 'school-saml.edu' });

		await page.goto('/login');

		const ssoRequest = page.waitForRequest(
			(req) => req.url().includes('/api/auth/sign-in/sso') && req.method() === 'POST',
			{ timeout: 5000 }
		);

		await page.getByRole('button', { name: /Continue with SSO/i }).click();

		const req = await ssoRequest;
		const body = req.postDataJSON() as { providerId?: string };
		expect(body.providerId).toBe('school-saml');
	});

	test('SP metadata endpoint serves valid XML for the configured providerId', async ({
		request
	}) => {
		insertSamlProvider({ providerId: 'school-saml', domain: 'school-saml.edu' });

		const response = await request.get(
			'/api/auth/sso/saml2/sp/metadata?providerId=school-saml'
		);
		expect(response.ok()).toBe(true);
		const contentType = response.headers()['content-type'] ?? '';
		expect(contentType).toMatch(/xml/);

		const body = await response.text();
		// SP metadata should declare an EntityDescriptor whose entityID matches the
		// audience we wrote into samlConfig.
		expect(body).toContain('EntityDescriptor');
		expect(body).toContain('school-saml');
	});

	test('mixed OIDC + SAML providers each get their own button labelled by domain', async ({
		page
	}) => {
		// Reuse the OIDC seed pattern from sso-login.spec.ts.
		const db = openDb();
		db.run(
			'INSERT INTO ssoProvider (id, issuer, providerId, domain, oidcConfig) VALUES (?, ?, ?, ?, ?)',
			[
				crypto.randomUUID(),
				'https://oidc.example.com',
				'oidc-idp',
				'oidc.example',
				JSON.stringify({
					clientId: 'test-client',
					clientSecret: 'test-secret',
					discoveryEndpoint: 'https://oidc.example.com/.well-known/openid-configuration',
					scopes: ['openid', 'profile', 'email']
				})
			]
		);
		db.close();
		insertSamlProvider({ providerId: 'saml-idp', domain: 'saml.example' });

		await page.goto('/login');
		await expect(
			page.getByRole('button', { name: /Continue with SSO — oidc\.example/i })
		).toBeVisible();
		await expect(
			page.getByRole('button', { name: /Continue with SSO — saml\.example/i })
		).toBeVisible();
	});

	test.afterAll(() => {
		clearProviders();
	});
});
