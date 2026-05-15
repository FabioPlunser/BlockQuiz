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

export const saveSsoProviderSchema = z.object({
	// Optional on create — server generates a UUID. Present (hidden field) on edit.
	providerId: z.string().optional().default(''),
	issuer: z.url(),
	domain: z.string().min(1),
	discoveryEndpoint: z.url(),
	clientId: z.string().min(1),
	clientSecret: z.string().optional().default(''),
	scopes: z.string().optional().default('openid profile email')
});

export const deleteSsoProviderSchema = z.object({
	providerId: z.string().min(1)
});

export const passwordLoginModeSchema = z.object({
	mode: z.enum(['always', 'fallback'])
});

export const saveRoleMapSchema = z.object({
	admin: z.string().optional().default(''),
	author: z.string().optional().default(''),
	teacher: z.string().optional().default('')
});

export const sendTestEmailSchema = z.object({
	to: z.email().optional()
});
