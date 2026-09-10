import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sso } from '@better-auth/sso';
import { db } from '$db/client';
import { user as userTable, ssoProvider } from '$db/schema';
import { eq } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';
import { logger } from '$lib/logs/logger';
import { sendEmail } from '$lib/server/email';
import { getSsoRoleMap } from '$lib/server/settings';
import { Role } from '$lib/roles';
import {
	extractGroupClaims,
	reconcileClassMembership,
	recordSeenGroups
} from '$lib/server/class-sync';
import { writeAuditLog } from '$lib/server/audit';

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
// The claim source list is shared with class-sync via extractGroupClaims so the
// two systems always agree on which userInfo keys count as group claims.
async function mapClaimsToRole(userInfo: Record<string, unknown>): Promise<Role> {
	const claimGroups = new Set(extractGroupClaims(userInfo));

	const map = await getSsoRoleMap();
	const matches = (raw: string | undefined) =>
		(raw ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
			.some((g) => claimGroups.has(g));

	if (matches(map.admin)) return Role.ADMIN;
	if (matches(map.teacher)) return Role.TEACHER;
	return Role.STUDENT;
}

export const auth = betterAuth({
	baseURL: authBaseURL,
	secret: env.AUTH_SECRET,
	plugins: [
		sso({
			provisionUser: async ({ user, userInfo, provider }) => {
				// JIT: align role with IdP claims on every login so group changes propagate.
				// For SAML providers, the per-provider mapping.extraFields.groups directive
				// flattens whichever IdP attribute holds the group list into `userInfo.groups`,
				// so this hook stays protocol-agnostic.
				const role = await mapClaimsToRole(userInfo);
				if (user.role !== role) {
					await db.update(userTable).set({ role }).where(eq(userTable.id, user.id));
					logger.info('SSO role updated from IdP claims', {
						userId: user.id,
						email: user.email,
						role
					});
				}

				// Reconcile IdP-owned class memberships from the claim deltas. We look up
				// our local ssoProvider row id via the better-auth provider's stable
				// providerId string. If we can't find it (bootstrap edge case), skip the
				// sync entirely — better to leave memberships untouched than to wipe them.
				const [providerRow] = await db
					.select({ id: ssoProvider.id })
					.from(ssoProvider)
					.where(eq(ssoProvider.providerId, provider.providerId))
					.limit(1);
				if (!providerRow) return;

				const claimedGroups = extractGroupClaims(userInfo);
				try {
					const result = await reconcileClassMembership(db, {
						userId: user.id,
						ssoProviderId: providerRow.id,
						claimedGroups,
						now: Date.now()
					});
					if (result.added.length || result.removed.length) {
						void writeAuditLog({
							actorUserId: user.id,
							action: 'class.sync',
							category: 'system',
							details: {
								ssoProviderId: providerRow.id,
								added: result.added,
								removed: result.removed,
								unmatchedCount: result.unmatchedGroups.length
							}
						});
					}
				} catch (err) {
					// Class sync MUST NOT block login. Log and continue.
					logger.error('class-sync failed during provisionUser', {
						userId: user.id,
						ssoProviderId: providerRow.id,
						error: err instanceof Error ? err.message : String(err)
					});
				}

				// Discovery surface — record every claim value, fire-and-forget.
				void recordSeenGroups(db, providerRow.id, claimedGroups, user.id, Date.now()).catch(
					(err) =>
						logger.warn('idp-group discovery upsert failed', {
							error: err instanceof Error ? err.message : String(err)
						})
				);
			},
			provisionUserOnEveryLogin: true,
			saml: {
				enableInResponseToValidation: true,
				allowIdpInitiated: false,
				requireTimestamps: true,
				clockSkew: 60_000
			}
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
