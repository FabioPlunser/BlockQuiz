// Pure helpers for IdP-driven class membership reconciliation. Kept free of
// SvelteKit/auth imports so each branch can be unit-tested directly against an
// in-memory drizzle SQLite database.

import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { classes, classUsers, idpGroupSeen } from '$db/schema';

/**
 * Pull every string group-claim value out of an SSO userInfo bag. School IdPs
 * use different attribute names — `groups` (OIDC standard), `memberOf` (AD/LDAP),
 * `eduPersonAffiliation` (Shibboleth/SAML federations). We treat any of them as
 * sources and let the SAML per-provider mapping flatten the right attribute
 * into one of those keys. Returns a deduped, sorted array so callers can compare
 * cheaply.
 */
export function extractGroupClaims(userInfo: Record<string, unknown>): string[] {
	const acc = new Set<string>();
	for (const key of ['groups', 'memberOf', 'eduPersonAffiliation', 'roles', 'role']) {
		const value = userInfo[key];
		if (Array.isArray(value)) {
			for (const item of value) if (typeof item === 'string' && item) acc.add(item);
		} else if (typeof value === 'string' && value) {
			acc.add(value);
		}
	}
	return [...acc].sort();
}

export type ReconcileInput = {
	userId: string;
	ssoProviderId: string;
	claimedGroups: string[];
	now: number;
};

export type ReconcileResult = {
	added: { classId: string; externalKey: string }[];
	removed: { classId: string; externalKey: string }[];
	unmatchedGroups: string[];
};

// drizzle's BunSQLiteDatabase is the runtime; for unit tests against a fresh
// in-memory database the shape is identical. Accept the generic type so the
// helper compiles for both.
type Db = BunSQLiteDatabase<Record<string, unknown>>;

/**
 * Bring the user's `source='sso'` memberships in line with the latest claim set
 * — for this provider only. Manual rows, rows in other providers' classes, and
 * rows in manual (no-provider) classes are never touched.
 *
 * Atomic per call: the insert/delete runs inside a single transaction so a
 * crash mid-sync can't leave the user with half a class roster.
 */
export async function reconcileClassMembership(
	db: Db,
	input: ReconcileInput
): Promise<ReconcileResult> {
	const { userId, ssoProviderId, claimedGroups, now } = input;

	const providerClasses = await db
		.select({ id: classes.id, externalKey: classes.externalKey })
		.from(classes)
		.where(
			and(
				eq(classes.ssoProviderId, ssoProviderId),
				sql`${classes.externalKey} IS NOT NULL`,
				isNull(classes.archivedAt)
			)
		);

	const byKey = new Map<string, string>();
	for (const c of providerClasses) {
		if (c.externalKey) byKey.set(c.externalKey, c.id);
	}
	const providerClassIds = providerClasses.map((c) => c.id);

	const claimed = new Set(claimedGroups);
	const targetClassIds = new Set<string>();
	for (const key of claimed) {
		const id = byKey.get(key);
		if (id) targetClassIds.add(id);
	}

	const currentRows =
		providerClassIds.length === 0
			? []
			: await db
					.select({ id: classUsers.id, classId: classUsers.classId })
					.from(classUsers)
					.where(
						and(
							eq(classUsers.userId, userId),
							eq(classUsers.source, 'sso'),
							inArray(classUsers.classId, providerClassIds)
						)
					);

	const currentClassIds = new Set(currentRows.map((r) => r.classId));
	const toAddClassIds = [...targetClassIds].filter((id) => !currentClassIds.has(id));
	const toRemoveRowIds = currentRows.filter((r) => !targetClassIds.has(r.classId)).map((r) => r.id);

	if (toAddClassIds.length > 0 || toRemoveRowIds.length > 0) {
		await db.transaction(async (tx) => {
			if (toAddClassIds.length > 0) {
				await tx.insert(classUsers).values(
					toAddClassIds.map((classId) => ({
						id: crypto.randomUUID(),
						classId,
						userId,
						source: 'sso' as const,
						addedBy: null,
						createdAt: now,
						updatedAt: now
					}))
				);
			}
			if (toRemoveRowIds.length > 0) {
				await tx.delete(classUsers).where(inArray(classUsers.id, toRemoveRowIds));
			}
		});
	}

	const externalKeyById = new Map(providerClasses.map((c) => [c.id, c.externalKey!]));
	return {
		added: toAddClassIds.map((id) => ({ classId: id, externalKey: externalKeyById.get(id)! })),
		removed: currentRows
			.filter((r) => !targetClassIds.has(r.classId))
			.map((r) => ({ classId: r.classId, externalKey: externalKeyById.get(r.classId)! })),
		unmatchedGroups: [...claimed].filter((g) => !byKey.has(g)).sort()
	};
}

/**
 * Cap on how many sample userIds we keep per (provider, externalKey). Enough to
 * show admins "this group includes alice, bob, charlie..." without bloating the
 * row indefinitely.
 */
const SAMPLE_USER_ID_LIMIT = 5;

/**
 * Upsert one (ssoProviderId, externalKey) row per claim value. Bumps
 * occurrenceCount and lastSeenAt; keeps up to SAMPLE_USER_ID_LIMIT distinct
 * sample user ids. Best-effort — failures here MUST NOT block login, so callers
 * should fire-and-forget this with a swallowed catch.
 */
export async function recordSeenGroups(
	db: Db,
	ssoProviderId: string,
	groups: string[],
	userId: string,
	now: number
): Promise<void> {
	if (groups.length === 0) return;

	for (const externalKey of groups) {
		const existing = await db
			.select({
				id: idpGroupSeen.id,
				sampleUserIds: idpGroupSeen.sampleUserIds,
				occurrenceCount: idpGroupSeen.occurrenceCount
			})
			.from(idpGroupSeen)
			.where(
				and(
					eq(idpGroupSeen.ssoProviderId, ssoProviderId),
					eq(idpGroupSeen.externalKey, externalKey)
				)
			)
			.limit(1);

		if (existing.length === 0) {
			await db.insert(idpGroupSeen).values({
				id: crypto.randomUUID(),
				ssoProviderId,
				externalKey,
				firstSeenAt: now,
				lastSeenAt: now,
				occurrenceCount: 1,
				sampleUserIds: [userId]
			});
		} else {
			const row = existing[0];
			// drizzle's mode: 'json' returns the parsed value as the typed array.
			const samples = Array.isArray(row.sampleUserIds) ? [...row.sampleUserIds] : [];
			if (!samples.includes(userId) && samples.length < SAMPLE_USER_ID_LIMIT) {
				samples.push(userId);
			}
			await db
				.update(idpGroupSeen)
				.set({
					lastSeenAt: now,
					occurrenceCount: row.occurrenceCount + 1,
					sampleUserIds: samples
				})
				.where(eq(idpGroupSeen.id, row.id));
		}
	}
}
