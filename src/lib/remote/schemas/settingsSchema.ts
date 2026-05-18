import { z } from 'zod';

export const emailDriverSchema = z.enum(['file', 'smtp', 'graph']);

export const saveEmailSchema = z.object({
	driver: emailDriverSchema,
	from: z.string().optional().default(''),
	smtpHost: z.string().optional().default(''),
	smtpPort: z.string().optional().default(''),
	smtpUser: z.string().optional().default(''),
	smtpPassword: z.string().optional().default(''),
	smtpSecure: z.string().optional().default('auto'),
	graphTenantId: z.string().optional().default(''),
	graphClientId: z.string().optional().default(''),
	graphClientSecret: z.string().optional().default(''),
	graphFromUser: z.string().optional().default('')
});

// Combined schema for OIDC and SAML. The form sends `type` to indicate which
// branch is active; per-protocol field requirements are enforced in the remote
// handler so the SvelteKit form-fields helper sees a flat object.
export const saveSsoProviderSchema = z.object({
	// Optional on create — server generates a UUID. Present (hidden field) on edit.
	providerId: z.string().optional().default(''),
	type: z.enum(['oidc', 'saml']).default('oidc'),
	issuer: z.string().min(1),
	domain: z.string().min(1),
	// OIDC fields
	discoveryEndpoint: z.string().optional().default(''),
	clientId: z.string().optional().default(''),
	clientSecret: z.string().optional().default(''),
	scopes: z.string().optional().default('openid profile email'),
	// SAML fields
	entryPoint: z.string().optional().default(''),
	idpEntityId: z.string().optional().default(''),
	idpCert: z.string().optional().default(''),
	audience: z.string().optional().default(''),
	spPrivateKey: z.string().optional().default(''),
	spCert: z.string().optional().default(''),
	attrEmail: z.string().optional().default(''),
	attrName: z.string().optional().default(''),
	attrGroups: z.string().optional().default('')
});

export const deleteSsoProviderSchema = z.object({
	providerId: z.string().min(1)
});

export const passwordLoginModeSchema = z.object({
	mode: z.enum(['always', 'fallback'])
});

export const saveRoleMapSchema = z.object({
	admin: z.string().optional().default(''),
	teacher: z.string().optional().default('')
});

export const sendTestEmailSchema = z.object({
	to: z.email().optional()
});
