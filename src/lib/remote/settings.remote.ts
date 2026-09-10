import { query, form, command, requested } from '$app/server';
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
import {
	SECRET_PLACEHOLDER,
	buildOidcConfig,
	buildSamlConfig,
	mapRowToProvider
} from '$lib/server/sso-config';

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
		await requested(getEmailSettings, 1).refreshAll();
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
			category: 'admin',
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
		domain: row.domain,
		type: row.samlConfig ? ('saml' as const) : ('oidc' as const)
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
		await requested(getAuthSettings, 1).refreshAll();
		await requested(getPublicAuthSettings, 1).refreshAll();
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
	const baseUrl = env.BETTER_AUTH_URL ?? '';
	return rows.map((row) => mapRowToProvider(row, baseUrl));
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

		const baseUrl = env.BETTER_AUTH_URL ?? '';

		let prevOidc: Record<string, unknown> | null = null;
		let prevSaml: Record<string, unknown> | null = null;
		if (existing.length > 0) {
			try {
				prevOidc = existing[0].oidcConfig ? JSON.parse(existing[0].oidcConfig) : null;
			} catch {
				prevOidc = null;
			}
			try {
				prevSaml = existing[0].samlConfig ? JSON.parse(existing[0].samlConfig) : null;
			} catch {
				prevSaml = null;
			}
		}

		const providerId = data.providerId || crypto.randomUUID();

		let oidcConfig: string | null = null;
		let samlConfig: string | null = null;

		if (data.type === 'oidc') {
			const built = buildOidcConfig(data, prevOidc);
			if (!built.ok) {
				if (built.error.startsWith('Client secret')) invalid(built.error);
				return { success: false as const, error: built.error };
			}
			oidcConfig = built.value;
		} else {
			const built = buildSamlConfig(data, prevSaml, baseUrl, providerId);
			if (!built.ok) {
				if (built.error.startsWith('IdP certificate')) invalid(built.error);
				return { success: false as const, error: built.error };
			}
			samlConfig = built.value;
		}

		if (existing.length === 0) {
			await db.insert(ssoProvider).values({
				id: crypto.randomUUID(),
				providerId,
				issuer: data.issuer,
				domain: data.domain,
				oidcConfig,
				samlConfig,
				organizationId: null,
				userId: null
			});
			await writeAuditLog({
				actorUserId: actor.id,
				action: 'sso.provider.create',
				category: 'admin',
				details: { providerId, domain: data.domain, type: data.type }
			});
			await requested(getSsoProviders, 1).refreshAll();
			await requested(getPublicSsoProviders, 1).refreshAll();
			return { success: true as const, providerId };
		} else {
			await db
				.update(ssoProvider)
				.set({
					issuer: data.issuer,
					domain: data.domain,
					oidcConfig,
					samlConfig
				})
				.where(eq(ssoProvider.providerId, data.providerId));
			await writeAuditLog({
				actorUserId: actor.id,
				action: 'sso.provider.update',
				category: 'admin',
				details: { providerId: data.providerId, domain: data.domain, type: data.type }
			});
			await requested(getSsoProviders, 1).refreshAll();
			await requested(getPublicSsoProviders, 1).refreshAll();
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
			category: 'admin',
			details: { providerId: data.providerId }
		});
		await requested(getSsoProviders, 1).refreshAll();
		await requested(getPublicSsoProviders, 1).refreshAll();
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
				teacher: data.teacher
			},
			actor.id
		);
		await requested(getRoleMap, 1).refreshAll();
		return { success: true as const };
	} catch (e) {
		return {
			success: false as const,
			error: e instanceof Error ? e.message : 'Failed to save role map'
		};
	}
});
