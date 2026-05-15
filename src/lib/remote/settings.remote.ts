import { query, form, command } from '$app/server';
import { db } from '$db/client';
import { ssoProvider } from '$db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth } from '$lib/utils/requireAuth';
import { Role } from '$lib/roles';
import { invalid } from '@sveltejs/kit';
import {
	getEmailConfig,
	saveEmailConfig,
	getSsoRoleMap,
	saveSsoRoleMap,
	getPasswordLoginMode,
	savePasswordLoginMode
} from '$lib/server/settings';
import { sendEmail } from '$lib/server/email';
import { writeAuditLog } from '$lib/server/audit';
import {
	saveEmailSchema,
	saveSsoProviderSchema,
	deleteSsoProviderSchema,
	saveRoleMapSchema,
	sendTestEmailSchema,
	passwordLoginModeSchema
} from '$remote/schemas/settingsSchema';
import { env } from '$env/dynamic/private';

const SECRET_PLACEHOLDER = '__keep__';

export const getEmailSettings = query(async () => {
	requireAuth(Role.ADMIN);
	const cfg = await getEmailConfig();
	return {
		driver: cfg.driver,
		from: cfg.from ?? '',
		smtp: {
			host: cfg.smtp.host ?? '',
			port: cfg.smtp.port ?? 587,
			secure: cfg.smtp.secure ?? false,
			user: cfg.smtp.user ?? '',
			passwordSet: Boolean(cfg.smtp.password)
		},
		graph: {
			tenantId: cfg.graph.tenantId ?? '',
			clientId: cfg.graph.clientId ?? '',
			clientSecretSet: Boolean(cfg.graph.clientSecret),
			fromUser: cfg.graph.fromUser ?? ''
		},
		envOverrides: cfg.envOverrides
	};
});

export const saveEmailSettings = form(saveEmailSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);
	try {
		const smtpPort = data.smtpPort ? Number(data.smtpPort) : undefined;
		const smtpSecure =
			data.smtpSecure === 'true' ? true : data.smtpSecure === 'false' ? false : undefined;

		// Only overwrite secrets if the form sent a non-empty value other than the placeholder
		const smtpPassword =
			data.smtpPassword && data.smtpPassword !== SECRET_PLACEHOLDER
				? data.smtpPassword
				: undefined;
		const graphClientSecret =
			data.graphClientSecret && data.graphClientSecret !== SECRET_PLACEHOLDER
				? data.graphClientSecret
				: undefined;

		await saveEmailConfig(
			{
				driver: data.driver,
				from: data.from || undefined,
				smtp: {
					host: data.smtpHost || undefined,
					port: smtpPort,
					secure: smtpSecure,
					user: data.smtpUser || undefined,
					password: smtpPassword
				},
				graph: {
					tenantId: data.graphTenantId || undefined,
					clientId: data.graphClientId || undefined,
					clientSecret: graphClientSecret,
					fromUser: data.graphFromUser || undefined
				}
			},
			actor.id
		);
		return { success: true as const };
	} catch (e) {
		console.error('saveEmailSettings failed', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to save email settings'
		};
	}
});

export const sendTestEmail = command(sendTestEmailSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);
	const to = data.to || actor.email;
	try {
		await sendEmail({
			to,
			subject: 'BlockQuiz email test',
			text: `This is a BlockQuiz email transport test sent at ${new Date().toISOString()}.`
		});
		await writeAuditLog({
			actorUserId: actor.id,
			action: 'settings.email.test',
			details: { to }
		});
		return { success: true as const, to };
	} catch (e) {
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Test email failed'
		};
	}
});

// Public: minimal provider list + auth mode for the login page. No auth required, only safe fields.
export const getPublicSsoProviders = query(async () => {
	const rows = await db.select().from(ssoProvider);
	return rows.map((row) => ({
		providerId: row.providerId,
		domain: row.domain
	}));
});

export const getPublicAuthSettings = query(async () => {
	const mode = await getPasswordLoginMode();
	return { passwordLoginMode: mode };
});

export const getAuthSettings = query(async () => {
	requireAuth(Role.ADMIN);
	return { passwordLoginMode: await getPasswordLoginMode() };
});

export const saveAuthSettings = form(passwordLoginModeSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);
	try {
		await savePasswordLoginMode(data.mode, actor.id);
		return { success: true as const };
	} catch (e) {
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to save auth settings'
		};
	}
});

export const getSsoProviders = query(async () => {
	requireAuth(Role.ADMIN);
	const rows = await db.select().from(ssoProvider);
	return rows.map((row) => {
		let parsedOidc: Record<string, unknown> | null = null;
		try {
			parsedOidc = row.oidcConfig ? JSON.parse(row.oidcConfig) : null;
		} catch {
			parsedOidc = null;
		}
		return {
			id: row.id,
			providerId: row.providerId,
			issuer: row.issuer,
			domain: row.domain,
			discoveryEndpoint: (parsedOidc?.discoveryEndpoint as string | undefined) ?? '',
			clientId: (parsedOidc?.clientId as string | undefined) ?? '',
			scopes: Array.isArray(parsedOidc?.scopes)
				? (parsedOidc?.scopes as string[]).join(' ')
				: 'openid profile email',
			clientSecretSet: Boolean(parsedOidc?.clientSecret),
			callbackUrl: `${env.BETTER_AUTH_URL ?? ''}/api/auth/sso/callback/${row.providerId}`
		};
	});
});

export const saveSsoProvider = form(saveSsoProviderSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);
	try {
		// providerId may be: empty (server generates), client-pre-generated UUID (new provider
		// where the admin already copied the callback URL), or an existing row's id (edit).
		const existing = data.providerId
			? await db
					.select()
					.from(ssoProvider)
					.where(eq(ssoProvider.providerId, data.providerId))
					.limit(1)
			: [];

		let existingSecret: string | undefined;
		if (existing.length > 0 && existing[0].oidcConfig) {
			try {
				const parsed = JSON.parse(existing[0].oidcConfig);
				existingSecret = parsed.clientSecret;
			} catch {
				/* ignore */
			}
		}

		const clientSecret =
			data.clientSecret && data.clientSecret !== SECRET_PLACEHOLDER
				? data.clientSecret
				: existingSecret;

		if (!clientSecret) {
			invalid('Client secret is required for new providers');
			return { success: false as const, error: 'Client secret is required for new providers' };
		}

		const oidcConfig = JSON.stringify({
			clientId: data.clientId,
			clientSecret,
			discoveryEndpoint: data.discoveryEndpoint,
			scopes: data.scopes.split(/\s+/).filter(Boolean)
		});

		if (existing.length === 0) {
			// New provider: use the client-supplied UUID if present (admin already copied the
			// callback URL to the IdP), otherwise generate one server-side.
			const providerId = data.providerId || crypto.randomUUID();
			await db.insert(ssoProvider).values({
				id: crypto.randomUUID(),
				providerId,
				issuer: data.issuer,
				domain: data.domain,
				oidcConfig,
				samlConfig: null,
				organizationId: null,
				userId: null
			});
			await writeAuditLog({
				actorUserId: actor.id,
				action: 'sso.provider.create',
				details: { providerId, domain: data.domain }
			});
			return { success: true as const, providerId };
		} else {
			await db
				.update(ssoProvider)
				.set({
					issuer: data.issuer,
					domain: data.domain,
					oidcConfig
				})
				.where(eq(ssoProvider.providerId, data.providerId));
			await writeAuditLog({
				actorUserId: actor.id,
				action: 'sso.provider.update',
				details: { providerId: data.providerId, domain: data.domain }
			});
			return { success: true as const, providerId: data.providerId };
		}
	} catch (e) {
		console.error('saveSsoProvider failed', e);
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to save SSO provider'
		};
	}
});

export const deleteSsoProvider = command(deleteSsoProviderSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);
	try {
		await db.delete(ssoProvider).where(eq(ssoProvider.providerId, data.providerId));
		await writeAuditLog({
			actorUserId: actor.id,
			action: 'sso.provider.delete',
			details: { providerId: data.providerId }
		});
		return { success: true as const };
	} catch (e) {
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to delete SSO provider'
		};
	}
});

export const getRoleMap = query(async () => {
	requireAuth(Role.ADMIN);
	return await getSsoRoleMap();
});

export const saveRoleMap = form(saveRoleMapSchema, async (data) => {
	const actor = requireAuth(Role.ADMIN);
	try {
		await saveSsoRoleMap(
			{
				admin: data.admin,
				author: data.author,
				teacher: data.teacher
			},
			actor.id
		);
		return { success: true as const };
	} catch (e) {
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to save role map'
		};
	}
});
