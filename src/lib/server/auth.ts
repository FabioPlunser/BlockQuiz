import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sso } from '@better-auth/sso';
import { db } from '$db/client';
import { user as userTable } from '$db/schema';
import { eq } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { logger } from '$lib/logs/logger';
import { sendEmail } from '$lib/server/email';
import { getSsoRoleMap } from '$lib/server/settings';
import { Role } from '$lib/roles';

const authPort = env.PORT ?? (env.NODE_ENV === 'production' ? '3000' : '5173');
const isProductionRuntime = env.NODE_ENV === 'production' && !building;

if (isProductionRuntime && !env.BETTER_AUTH_URL) {
	throw new Error('BETTER_AUTH_URL is required in production');
}

if (isProductionRuntime && !env.AUTH_SECRET) {
	throw new Error('AUTH_SECRET is required in production');
}

const authBaseURL = env.BETTER_AUTH_URL ?? `http://localhost:${authPort}`;

async function hashPassword(password: string) {
	return Bun.password.hash(password);
}

async function verifyPassword({ hash, password }: { hash: string; password: string }) {
	return Bun.password.verify(password, hash);
}

async function deliverResetUrl(email: string, url: string) {
	logger.info('Password reset requested', { email });
	await sendEmail({
		to: email,
		subject: 'BlockQuiz password reset',
		text: [
			'A password reset was requested for your BlockQuiz account.',
			'',
			`Reset URL: ${url}`,
			'',
			'If you did not request this reset, you can ignore this message.'
		].join('\n')
	});
}

// Map IdP claims to a BlockQuiz role. Reads the role map from app_settings
// (env vars SSO_ROLE_MAP_* override the stored values, see getSsoRoleMap).
async function mapClaimsToRole(userInfo: Record<string, unknown>): Promise<Role> {
	const claimGroups = new Set<string>();
	for (const key of ['groups', 'roles', 'role']) {
		const value = userInfo[key];
		if (Array.isArray(value)) {
			for (const item of value) if (typeof item === 'string') claimGroups.add(item);
		} else if (typeof value === 'string') {
			claimGroups.add(value);
		}
	}

	const map = await getSsoRoleMap();
	const matches = (raw: string | undefined) =>
		(raw ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
			.some((g) => claimGroups.has(g));

	if (matches(map.admin)) return Role.ADMIN;
	if (matches(map.author)) return Role.AUTHOR;
	if (matches(map.teacher)) return Role.TEACHER;
	return Role.STUDENT;
}

export const auth = betterAuth({
	baseURL: authBaseURL,
	secret: env.AUTH_SECRET,
	plugins: [
		sso({
			provisionUser: async ({ user, userInfo }) => {
				// JIT: align role with IdP claims on every login so group changes propagate.
				const role = await mapClaimsToRole(userInfo);
				if (user.role !== role) {
					await db.update(userTable).set({ role }).where(eq(userTable.id, user.id));
					logger.info('SSO role updated from IdP claims', {
						userId: user.id,
						email: user.email,
						role
					});
				}
			},
			provisionUserOnEveryLogin: true
		}),
		sveltekitCookies(getRequestEvent)
	],
	database: drizzleAdapter(db, {
		provider: 'sqlite'
	}),
	emailAndPassword: {
		enabled: true,
		password: {
			hash: hashPassword,
			verify: verifyPassword
		},
		sendResetPassword: async ({ user, url }) => {
			await deliverResetUrl(user.email, url);
		},
		resetPasswordTokenExpiresIn: 60 * 60
	},
	user: {
		additionalFields: {
			role: {
				type: 'string',
				required: true
			},
			active: {
				type: 'boolean',
				required: true,
				defaultValue: true
			}
		}
	}
});
