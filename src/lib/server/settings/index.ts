import { db } from '$db/client';
import { appSettings } from '$db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { writeAuditLog } from '$lib/server/audit';

export type EmailDriver = 'file' | 'smtp' | 'graph';

export interface SmtpConfig {
	host?: string;
	port?: number;
	secure?: boolean;
	user?: string;
	password?: string;
}

export interface GraphConfig {
	tenantId?: string;
	clientId?: string;
	clientSecret?: string;
	fromUser?: string;
}

export interface EmailConfig {
	driver: EmailDriver;
	from?: string;
	smtp: SmtpConfig;
	graph: GraphConfig;
	// flags telling the UI which fields are env-overridden
	envOverrides: Record<string, boolean>;
}

export interface SsoRoleMap {
	admin: string;
	teacher: string;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
	const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
	if (rows.length === 0) return fallback;
	return rows[0].value as T;
}

export async function setSetting(
	key: string,
	value: unknown,
	updatedBy: string | null,
	auditAction?: string
): Promise<void> {
	const now = Date.now();
	const existing = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
	if (existing.length === 0) {
		await db.insert(appSettings).values({
			key,
			value: value as never,
			updatedAt: now,
			updatedBy
		});
	} else {
		await db
			.update(appSettings)
			.set({ value: value as never, updatedAt: now, updatedBy })
			.where(eq(appSettings.key, key));
	}
	if (auditAction) {
		await writeAuditLog({
			actorUserId: updatedBy,
			action: auditAction,
			category: 'admin',
			details: { key }
		});
	}
}

function resolveEnvDriver(): EmailDriver | undefined {
	const v = env.EMAIL_DRIVER?.toLowerCase();
	if (v === 'file' || v === 'smtp' || v === 'graph') return v;
	return undefined;
}

export async function getEmailConfig(): Promise<EmailConfig> {
	const stored = await getSetting<Partial<EmailConfig>>('email.config', {});
	const envDriver = resolveEnvDriver();
	const smtpStored = (stored.smtp ?? {}) as SmtpConfig;
	const graphStored = (stored.graph ?? {}) as GraphConfig;

	const smtp: SmtpConfig = {
		host: env.SMTP_HOST ?? smtpStored.host,
		port: env.SMTP_PORT ? Number(env.SMTP_PORT) : smtpStored.port,
		secure: env.SMTP_SECURE !== undefined ? env.SMTP_SECURE === 'true' : smtpStored.secure,
		user: env.SMTP_USER ?? smtpStored.user,
		password: env.SMTP_PASSWORD ?? smtpStored.password
	};

	const graph: GraphConfig = {
		tenantId: env.GRAPH_TENANT_ID ?? graphStored.tenantId,
		clientId: env.GRAPH_CLIENT_ID ?? graphStored.clientId,
		clientSecret: env.GRAPH_CLIENT_SECRET ?? graphStored.clientSecret,
		fromUser: env.GRAPH_FROM_USER ?? graphStored.fromUser
	};

	const driver: EmailDriver = envDriver ?? stored.driver ?? 'file';
	const from = env.EMAIL_FROM ?? stored.from;

	const envOverrides: Record<string, boolean> = {
		driver: envDriver !== undefined,
		from: env.EMAIL_FROM !== undefined,
		'smtp.host': env.SMTP_HOST !== undefined,
		'smtp.port': env.SMTP_PORT !== undefined,
		'smtp.secure': env.SMTP_SECURE !== undefined,
		'smtp.user': env.SMTP_USER !== undefined,
		'smtp.password': env.SMTP_PASSWORD !== undefined,
		'graph.tenantId': env.GRAPH_TENANT_ID !== undefined,
		'graph.clientId': env.GRAPH_CLIENT_ID !== undefined,
		'graph.clientSecret': env.GRAPH_CLIENT_SECRET !== undefined,
		'graph.fromUser': env.GRAPH_FROM_USER !== undefined
	};

	return { driver, from, smtp, graph, envOverrides };
}

export async function saveEmailConfig(
	input: { driver: EmailDriver; from?: string; smtp?: SmtpConfig; graph?: GraphConfig },
	updatedBy: string
): Promise<void> {
	// Merge with existing so unspecified secret fields are preserved
	const existing = await getSetting<Partial<EmailConfig>>('email.config', {});
	const merged = {
		driver: input.driver,
		from: input.from ?? existing.from,
		smtp: {
			...(existing.smtp ?? {}),
			...(input.smtp ?? {})
		},
		graph: {
			...(existing.graph ?? {}),
			...(input.graph ?? {})
		}
	};
	await setSetting('email.config', merged, updatedBy, 'settings.email.update');
}

export async function getSsoRoleMap(): Promise<SsoRoleMap & { envOverrides: Record<string, boolean> }> {
	const stored = await getSetting<Partial<SsoRoleMap>>('sso.roleMap', {});
	return {
		admin: env.SSO_ROLE_MAP_ADMIN ?? stored.admin ?? '',
		teacher: env.SSO_ROLE_MAP_TEACHER ?? stored.teacher ?? '',
		envOverrides: {
			admin: env.SSO_ROLE_MAP_ADMIN !== undefined,
			teacher: env.SSO_ROLE_MAP_TEACHER !== undefined
		}
	};
}

export async function saveSsoRoleMap(input: SsoRoleMap, updatedBy: string): Promise<void> {
	await setSetting('sso.roleMap', input, updatedBy, 'settings.sso.roleMap.update');
}

// 'always': email/password always visible alongside SSO (default).
// 'fallback': SSO primary; password form hidden behind a toggle for admin recovery.
export type PasswordLoginMode = 'always' | 'fallback';

export async function getPasswordLoginMode(): Promise<PasswordLoginMode> {
	const stored = await getSetting<{ mode?: PasswordLoginMode }>('auth.passwordLogin', {});
	if (stored.mode === 'fallback') return 'fallback';
	return 'always';
}

export async function savePasswordLoginMode(
	mode: PasswordLoginMode,
	updatedBy: string
): Promise<void> {
	await setSetting('auth.passwordLogin', { mode }, updatedBy, 'settings.auth.passwordLogin.update');
}
