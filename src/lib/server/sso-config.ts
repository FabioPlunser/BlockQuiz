// Pure helpers for serialising SSO provider configuration. Kept free of
// db/env/auth imports so the branches can be unit-tested directly.

export const SECRET_PLACEHOLDER = '__keep__';

export type ProviderInput = {
	providerId: string;
	type: 'oidc' | 'saml';
	issuer: string;
	domain: string;
	// OIDC fields
	discoveryEndpoint?: string;
	clientId?: string;
	clientSecret?: string;
	scopes?: string;
	// SAML fields
	entryPoint?: string;
	idpEntityId?: string;
	idpCert?: string;
	audience?: string;
	spPrivateKey?: string;
	spCert?: string;
	attrEmail?: string;
	attrName?: string;
	attrGroups?: string;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Return the new secret if the admin typed one, else keep the previously stored value.
 * The form sends SECRET_PLACEHOLDER (or empty string) to indicate "leave unchanged".
 */
export function keepSecret(incoming: string | undefined, previous: unknown): string | undefined {
	if (incoming && incoming !== SECRET_PLACEHOLDER) return incoming;
	if (typeof previous === 'string' && previous) return previous;
	return undefined;
}

export function buildOidcConfig(
	data: ProviderInput,
	prev: Record<string, unknown> | null
): Result<string> {
	if (!data.discoveryEndpoint || !data.clientId) {
		return {
			ok: false,
			error: 'discoveryEndpoint and clientId are required for OIDC providers'
		};
	}
	const clientSecret = keepSecret(data.clientSecret, prev?.clientSecret);
	if (!clientSecret) {
		return { ok: false, error: 'Client secret is required for new providers' };
	}
	return {
		ok: true,
		value: JSON.stringify({
			clientId: data.clientId,
			clientSecret,
			discoveryEndpoint: data.discoveryEndpoint,
			scopes: (data.scopes ?? '').split(/\s+/).filter(Boolean)
		})
	};
}

export function buildSamlConfig(
	data: ProviderInput,
	prev: Record<string, unknown> | null,
	baseUrl: string,
	providerId: string
): Result<string> {
	if (!data.entryPoint || !data.idpEntityId) {
		return {
			ok: false,
			error: 'entryPoint and IdP entityID are required for SAML providers'
		};
	}
	const idpCert = keepSecret(data.idpCert, prev?.cert);
	if (!idpCert) {
		return { ok: false, error: 'IdP certificate is required for new SAML providers' };
	}
	const prevSp = (prev?.spMetadata ?? {}) as Record<string, unknown>;
	const spPrivateKey = keepSecret(data.spPrivateKey, prevSp?.privateKey);
	const spCert = keepSecret(data.spCert, prevSp?.metadata);
	const spEntityId =
		data.audience || `${baseUrl}/api/auth/sso/saml2/sp/metadata?providerId=${providerId}`;
	return {
		ok: true,
		value: JSON.stringify({
			issuer: data.idpEntityId,
			entryPoint: data.entryPoint,
			cert: idpCert,
			callbackUrl: `${baseUrl}/api/auth/sso/saml2/sp/acs/${providerId}`,
			audience: spEntityId,
			wantAssertionsSigned: true,
			spMetadata: {
				entityID: spEntityId,
				...(spCert ? { metadata: spCert } : {}),
				...(spPrivateKey ? { privateKey: spPrivateKey } : {})
			},
			mapping: {
				email: data.attrEmail || 'email',
				name: data.attrName || 'displayName',
				...(data.attrGroups ? { extraFields: { groups: data.attrGroups } } : {})
			}
		})
	};
}

export type ProviderRow = {
	id: string;
	providerId: string;
	issuer: string;
	domain: string;
	oidcConfig: string | null;
	samlConfig: string | null;
};

export function mapRowToProvider(row: ProviderRow, baseUrl: string) {
	let parsedOidc: Record<string, unknown> | null = null;
	let parsedSaml: Record<string, unknown> | null = null;
	try {
		parsedOidc = row.oidcConfig ? JSON.parse(row.oidcConfig) : null;
	} catch {
		parsedOidc = null;
	}
	try {
		parsedSaml = row.samlConfig ? JSON.parse(row.samlConfig) : null;
	} catch {
		parsedSaml = null;
	}
	const type: 'oidc' | 'saml' = parsedSaml ? 'saml' : 'oidc';
	const samlMapping = (parsedSaml?.mapping ?? {}) as Record<string, unknown>;
	const samlExtra = (samlMapping?.extraFields ?? {}) as Record<string, unknown>;
	const spMetadata = (parsedSaml?.spMetadata ?? {}) as Record<string, unknown>;
	return {
		id: row.id,
		providerId: row.providerId,
		type,
		issuer: row.issuer,
		domain: row.domain,
		// OIDC
		discoveryEndpoint: (parsedOidc?.discoveryEndpoint as string | undefined) ?? '',
		clientId: (parsedOidc?.clientId as string | undefined) ?? '',
		scopes: Array.isArray(parsedOidc?.scopes)
			? (parsedOidc?.scopes as string[]).join(' ')
			: 'openid profile email',
		clientSecretSet: Boolean(parsedOidc?.clientSecret),
		callbackUrl: `${baseUrl}/api/auth/sso/callback/${row.providerId}`,
		// SAML
		entryPoint: (parsedSaml?.entryPoint as string | undefined) ?? '',
		idpEntityId: (parsedSaml?.issuer as string | undefined) ?? '',
		audience: (parsedSaml?.audience as string | undefined) ?? '',
		attrEmail: (samlMapping?.email as string | undefined) ?? '',
		attrName: (samlMapping?.name as string | undefined) ?? '',
		attrGroups: (samlExtra?.groups as string | undefined) ?? '',
		idpCertSet: Boolean(parsedSaml?.cert),
		spPrivateKeySet: Boolean(spMetadata?.privateKey),
		spCertSet: Boolean(spMetadata?.metadata),
		acsUrl: `${baseUrl}/api/auth/sso/saml2/sp/acs/${row.providerId}`,
		samlMetadataUrl: `${baseUrl}/api/auth/sso/saml2/sp/metadata?providerId=${row.providerId}`
	};
}
