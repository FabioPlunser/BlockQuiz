import { describe, expect, it } from 'vitest';
import {
	SECRET_PLACEHOLDER,
	buildOidcConfig,
	buildSamlConfig,
	keepSecret,
	mapRowToProvider,
	type ProviderInput,
	type ProviderRow
} from './sso-config';

const BASE = 'https://app.test';
const PROVIDER_ID = 'school-idp';

const oidcInput = (overrides: Partial<ProviderInput> = {}): ProviderInput => ({
	providerId: PROVIDER_ID,
	type: 'oidc',
	issuer: 'https://idp.test',
	domain: 'school.test',
	discoveryEndpoint: 'https://idp.test/.well-known/openid-configuration',
	clientId: 'client-abc',
	clientSecret: 'shh',
	scopes: 'openid profile email',
	...overrides
});

const samlInput = (overrides: Partial<ProviderInput> = {}): ProviderInput => ({
	providerId: PROVIDER_ID,
	type: 'saml',
	issuer: 'https://idp.test',
	domain: 'school.test',
	entryPoint: 'https://idp.test/sso/saml2',
	idpEntityId: 'https://idp.test/metadata',
	idpCert: '-----BEGIN CERTIFICATE-----\nIDPCERT\n-----END CERTIFICATE-----',
	audience: '',
	spPrivateKey: '',
	spCert: '',
	attrEmail: '',
	attrName: '',
	attrGroups: '',
	...overrides
});

describe('keepSecret', () => {
	it('returns the new value when one is typed', () => {
		expect.assertions(1);
		expect(keepSecret('new-secret', 'old-secret')).toBe('new-secret');
	});

	it('keeps the previous value when the placeholder is sent', () => {
		expect.assertions(1);
		expect(keepSecret(SECRET_PLACEHOLDER, 'old-secret')).toBe('old-secret');
	});

	it('keeps the previous value when an empty string is sent', () => {
		expect.assertions(1);
		expect(keepSecret('', 'old-secret')).toBe('old-secret');
	});

	it('returns undefined when neither incoming nor previous is set', () => {
		expect.assertions(2);
		expect(keepSecret('', null)).toBeUndefined();
		expect(keepSecret(undefined, undefined)).toBeUndefined();
	});
});

describe('buildOidcConfig', () => {
	it('rejects when discoveryEndpoint is missing', () => {
		expect.assertions(2);
		const result = buildOidcConfig(oidcInput({ discoveryEndpoint: '' }), null);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/discoveryEndpoint/);
	});

	it('rejects when clientId is missing', () => {
		expect.assertions(2);
		const result = buildOidcConfig(oidcInput({ clientId: '' }), null);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/clientId/);
	});

	it('rejects new provider without clientSecret', () => {
		expect.assertions(2);
		const result = buildOidcConfig(oidcInput({ clientSecret: '' }), null);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/Client secret/);
	});

	it('keeps the existing clientSecret on edit when placeholder is sent', () => {
		expect.assertions(2);
		const result = buildOidcConfig(oidcInput({ clientSecret: SECRET_PLACEHOLDER }), {
			clientSecret: 'persisted-secret'
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			expect(parsed.clientSecret).toBe('persisted-secret');
		}
	});

	it('keeps the existing clientSecret on edit when blank is sent', () => {
		expect.assertions(2);
		const result = buildOidcConfig(oidcInput({ clientSecret: '' }), {
			clientSecret: 'persisted-secret'
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			expect(parsed.clientSecret).toBe('persisted-secret');
		}
	});

	it('splits the scopes string into an array, dropping empty tokens', () => {
		expect.assertions(2);
		const result = buildOidcConfig(oidcInput({ scopes: 'openid  profile\temail  ' }), null);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			expect(parsed.scopes).toStrictEqual(['openid', 'profile', 'email']);
		}
	});
});

describe('buildSamlConfig', () => {
	it('rejects when entryPoint is missing', () => {
		expect.assertions(2);
		const result = buildSamlConfig(samlInput({ entryPoint: '' }), null, BASE, PROVIDER_ID);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/entryPoint/);
	});

	it('rejects when idpEntityId is missing', () => {
		expect.assertions(2);
		const result = buildSamlConfig(samlInput({ idpEntityId: '' }), null, BASE, PROVIDER_ID);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/entityID/);
	});

	it('rejects new provider without idpCert', () => {
		expect.assertions(2);
		const result = buildSamlConfig(samlInput({ idpCert: '' }), null, BASE, PROVIDER_ID);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/IdP certificate/);
	});

	it('keeps previous IdP cert on edit when placeholder sent', () => {
		expect.assertions(2);
		const result = buildSamlConfig(
			samlInput({ idpCert: SECRET_PLACEHOLDER }),
			{ cert: 'PERSISTED-CERT' },
			BASE,
			PROVIDER_ID
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			expect(parsed.cert).toBe('PERSISTED-CERT');
		}
	});

	it('keeps previous SP private key and SP cert on edit when blank sent', () => {
		expect.assertions(3);
		const result = buildSamlConfig(
			samlInput({ spPrivateKey: '', spCert: '' }),
			{
				cert: 'PERSISTED-IDP-CERT',
				spMetadata: { privateKey: 'PERSISTED-KEY', metadata: 'PERSISTED-SP-CERT' }
			},
			BASE,
			PROVIDER_ID
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			expect(parsed.spMetadata.privateKey).toBe('PERSISTED-KEY');
			expect(parsed.spMetadata.metadata).toBe('PERSISTED-SP-CERT');
		}
	});

	it('omits spMetadata.metadata and privateKey when neither incoming nor previous is set', () => {
		expect.assertions(3);
		const result = buildSamlConfig(samlInput(), null, BASE, PROVIDER_ID);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			expect(parsed.spMetadata.metadata).toBeUndefined();
			expect(parsed.spMetadata.privateKey).toBeUndefined();
		}
	});

	it('defaults audience and SP entityID to the metadata URL when audience is blank', () => {
		expect.assertions(3);
		const result = buildSamlConfig(samlInput({ audience: '' }), null, BASE, PROVIDER_ID);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			const expected = `${BASE}/api/auth/sso/saml2/sp/metadata?providerId=${PROVIDER_ID}`;
			expect(parsed.audience).toBe(expected);
			expect(parsed.spMetadata.entityID).toBe(expected);
		}
	});

	it('uses the admin-provided audience when set', () => {
		expect.assertions(3);
		const result = buildSamlConfig(
			samlInput({ audience: 'https://sp.example.org/audience' }),
			null,
			BASE,
			PROVIDER_ID
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			expect(parsed.audience).toBe('https://sp.example.org/audience');
			expect(parsed.spMetadata.entityID).toBe('https://sp.example.org/audience');
		}
	});

	it('hardcodes callbackUrl to the SAML ACS endpoint', () => {
		expect.assertions(2);
		const result = buildSamlConfig(samlInput(), null, BASE, PROVIDER_ID);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			expect(parsed.callbackUrl).toBe(`${BASE}/api/auth/sso/saml2/sp/acs/${PROVIDER_ID}`);
		}
	});

	it('defaults mapping.email and mapping.name and omits extraFields when no groups attribute', () => {
		expect.assertions(4);
		const result = buildSamlConfig(samlInput(), null, BASE, PROVIDER_ID);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			expect(parsed.mapping.email).toBe('email');
			expect(parsed.mapping.name).toBe('displayName');
			expect(parsed.mapping.extraFields).toBeUndefined();
		}
	});

	it('honours custom attribute names and surfaces the groups attribute as extraFields.groups', () => {
		expect.assertions(4);
		const result = buildSamlConfig(
			samlInput({
				attrEmail: 'mail',
				attrName: 'cn',
				attrGroups: 'http://schemas.xmlsoap.org/claims/Group'
			}),
			null,
			BASE,
			PROVIDER_ID
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const parsed = JSON.parse(result.value);
			expect(parsed.mapping.email).toBe('mail');
			expect(parsed.mapping.name).toBe('cn');
			expect(parsed.mapping.extraFields.groups).toBe('http://schemas.xmlsoap.org/claims/Group');
		}
	});
});

describe('mapRowToProvider', () => {
	const makeRow = (overrides: Partial<ProviderRow> = {}): ProviderRow => ({
		id: 'row-1',
		providerId: PROVIDER_ID,
		issuer: 'https://idp.test',
		domain: 'school.test',
		oidcConfig: null,
		samlConfig: null,
		...overrides
	});

	it('classifies a row with only oidcConfig as OIDC and computes the callback URL', () => {
		expect.assertions(4);
		const row = makeRow({
			oidcConfig: JSON.stringify({
				clientId: 'cid',
				clientSecret: 'csec',
				discoveryEndpoint: 'https://idp.test/.well-known/openid-configuration',
				scopes: ['openid', 'profile']
			})
		});
		const result = mapRowToProvider(row, BASE);
		expect(result.type).toBe('oidc');
		expect(result.clientId).toBe('cid');
		expect(result.clientSecretSet).toBe(true);
		expect(result.callbackUrl).toBe(`${BASE}/api/auth/sso/callback/${PROVIDER_ID}`);
	});

	it('joins the OIDC scopes array back into a space-separated string', () => {
		expect.assertions(1);
		const row = makeRow({
			oidcConfig: JSON.stringify({
				clientId: 'cid',
				clientSecret: 'csec',
				discoveryEndpoint: 'https://idp.test/d',
				scopes: ['openid', 'profile', 'email']
			})
		});
		expect(mapRowToProvider(row, BASE).scopes).toBe('openid profile email');
	});

	it('classifies a row with samlConfig as SAML and exposes ACS + metadata URLs', () => {
		expect.assertions(5);
		const row = makeRow({
			samlConfig: JSON.stringify({
				issuer: 'https://idp.test/metadata',
				entryPoint: 'https://idp.test/sso/saml2',
				cert: 'IDPCERT',
				audience: 'https://app.test/saml/audience',
				spMetadata: { entityID: 'https://app.test/saml/audience', privateKey: 'PK' },
				mapping: {
					email: 'mail',
					name: 'cn',
					extraFields: { groups: 'memberOf' }
				}
			})
		});
		const result = mapRowToProvider(row, BASE);
		expect(result.type).toBe('saml');
		expect(result.entryPoint).toBe('https://idp.test/sso/saml2');
		expect(result.idpCertSet).toBe(true);
		expect(result.acsUrl).toBe(`${BASE}/api/auth/sso/saml2/sp/acs/${PROVIDER_ID}`);
		expect(result.samlMetadataUrl).toBe(
			`${BASE}/api/auth/sso/saml2/sp/metadata?providerId=${PROVIDER_ID}`
		);
	});

	it('reports spPrivateKeySet/spCertSet booleans without leaking the secrets', () => {
		expect.assertions(2);
		const row = makeRow({
			samlConfig: JSON.stringify({
				cert: 'IDPCERT',
				spMetadata: { privateKey: 'PK-SECRET', metadata: 'SP-CERT' }
			})
		});
		const result = mapRowToProvider(row, BASE);
		expect(result.spPrivateKeySet).toBe(true);
		expect(result.spCertSet).toBe(true);
	});

	it('falls back to OIDC defaults on broken JSON without throwing', () => {
		expect.assertions(2);
		const row = makeRow({ oidcConfig: '{not-json}' });
		const result = mapRowToProvider(row, BASE);
		expect(result.type).toBe('oidc');
		expect(result.scopes).toBe('openid profile email');
	});

	it('surfaces SAML group attribute via attrGroups for the edit form', () => {
		expect.assertions(1);
		const row = makeRow({
			samlConfig: JSON.stringify({
				cert: 'IDPCERT',
				mapping: { extraFields: { groups: 'eduPersonAffiliation' } }
			})
		});
		expect(mapRowToProvider(row, BASE).attrGroups).toBe('eduPersonAffiliation');
	});
});
