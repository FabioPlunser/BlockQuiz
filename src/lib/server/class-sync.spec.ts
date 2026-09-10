import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import * as schema from './db/schema';
import {
	extractGroupClaims,
	reconcileClassMembership,
	recordSeenGroups
} from './class-sync';

// Minimal schema for the sync tests. We only need user, ssoProvider, classes,
// classUsers, idpGroupSeen. Drizzle-kit's full migration touches 19 tables with
// cross-FKs we don't need; inline DDL keeps the test setup focused and fast.
const DDL = `
CREATE TABLE user (
  id text PRIMARY KEY NOT NULL,
  name text,
  email text NOT NULL UNIQUE,
  emailVerified integer NOT NULL DEFAULT 0,
  image text,
  createdAt integer NOT NULL DEFAULT (unixepoch() * 1000),
  updatedAt integer NOT NULL DEFAULT (unixepoch() * 1000),
  role text NOT NULL DEFAULT 'student',
  active integer NOT NULL DEFAULT 1
);
CREATE TABLE ssoProvider (
  id text PRIMARY KEY NOT NULL,
  issuer text NOT NULL,
  oidcConfig text,
  samlConfig text,
  userId text,
  providerId text NOT NULL UNIQUE,
  organizationId text,
  domain text NOT NULL
);
CREATE TABLE classes (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  description text,
  sso_provider_id text REFERENCES ssoProvider(id) ON DELETE SET NULL,
  external_key text,
  archived_at integer,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  created_by text REFERENCES user(id) ON DELETE SET NULL
);
CREATE TABLE class_users (
  id text PRIMARY KEY NOT NULL,
  class_id text NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual',
  added_by text REFERENCES user(id) ON DELETE SET NULL,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX class_users_class_user_source_uq ON class_users (class_id, user_id, source);
CREATE TABLE idp_group_seen (
  id text PRIMARY KEY NOT NULL,
  sso_provider_id text NOT NULL REFERENCES ssoProvider(id) ON DELETE CASCADE,
  external_key text NOT NULL,
  first_seen_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  last_seen_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  occurrence_count integer NOT NULL DEFAULT 1,
  sample_user_ids text NOT NULL DEFAULT '[]'
);
CREATE UNIQUE INDEX idp_group_seen_provider_key_uq ON idp_group_seen (sso_provider_id, external_key);
`;

type Db = BunSQLiteDatabase<typeof schema>;

function freshDb(): { db: Db; raw: Database } {
	const raw = new Database(':memory:');
	raw.exec('PRAGMA foreign_keys = ON');
	raw.exec(DDL);
	return { db: drizzle(raw, { schema }), raw };
}

function seedUser(db: Db, id: string, email: string): string {
	db.insert(schema.user).values({ id, email, role: 'student', active: true }).run();
	return id;
}

function seedProvider(db: Db, id: string, providerId = id): string {
	db.insert(schema.ssoProvider)
		.values({
			id,
			issuer: `https://idp-${id}.test`,
			providerId,
			domain: `${id}.test`
		})
		.run();
	return id;
}

function seedClass(
	db: Db,
	opts: {
		id: string;
		name: string;
		ssoProviderId?: string | null;
		externalKey?: string | null;
		archivedAt?: number | null;
	}
): string {
	db.insert(schema.classes)
		.values({
			id: opts.id,
			name: opts.name,
			ssoProviderId: opts.ssoProviderId ?? null,
			externalKey: opts.externalKey ?? null,
			archivedAt: opts.archivedAt ?? null
		})
		.run();
	return opts.id;
}

function seedMembership(db: Db, classId: string, userId: string, source: 'sso' | 'manual'): void {
	db.insert(schema.classUsers)
		.values({
			id: crypto.randomUUID(),
			classId,
			userId,
			source
		})
		.run();
}

function listMemberships(db: Db, userId: string) {
	return db
		.select({ classId: schema.classUsers.classId, source: schema.classUsers.source })
		.from(schema.classUsers)
		.where(eq(schema.classUsers.userId, userId))
		.all();
}

describe('extractGroupClaims', () => {
	it('reads SAML memberOf array and dedupes', () => {
		expect.assertions(1);
		expect(
			extractGroupClaims({
				memberOf: ['CN=class-9A', 'CN=class-9A', 'CN=class-10B']
			})
		).toStrictEqual(['CN=class-10B', 'CN=class-9A']);
	});

	it('reads OIDC groups array', () => {
		expect.assertions(1);
		expect(extractGroupClaims({ groups: ['admin', 'class-9A'] })).toStrictEqual([
			'admin',
			'class-9A'
		]);
	});

	it('handles a single-string claim', () => {
		expect.assertions(1);
		expect(extractGroupClaims({ groups: 'class-9A' })).toStrictEqual(['class-9A']);
	});

	it('returns empty array when no group claim is present', () => {
		expect.assertions(1);
		expect(extractGroupClaims({ email: 'anna@school.test' })).toStrictEqual([]);
	});

	it('unions across multiple known group-claim keys', () => {
		expect.assertions(1);
		expect(
			extractGroupClaims({
				groups: ['class-9A'],
				memberOf: ['CN=teachers'],
				eduPersonAffiliation: 'student'
			})
		).toStrictEqual(['CN=teachers', 'class-9A', 'student']);
	});

	it('skips non-string array items', () => {
		expect.assertions(1);
		expect(extractGroupClaims({ groups: ['class-9A', 42, null, 'class-10B'] })).toStrictEqual([
			'class-10B',
			'class-9A'
		]);
	});
});

describe('reconcileClassMembership', () => {
	let db: Db;
	let now: number;
	let userId: string;
	let providerA: string;

	beforeEach(() => {
		({ db } = freshDb());
		now = 1_700_000_000_000;
		userId = seedUser(db, 'user-anna', 'anna@school.test');
		providerA = seedProvider(db, 'prov-a');
	});

	it('first login with matching claim → 1 add / 0 remove', async () => {
		expect.assertions(4);
		seedClass(db, {
			id: 'cls-9a',
			name: '9A',
			ssoProviderId: providerA,
			externalKey: 'CN=class-9A'
		});

		const result = await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: ['CN=class-9A'],
			now
		});

		expect(result.added).toHaveLength(1);
		expect(result.added[0].classId).toBe('cls-9a');
		expect(result.removed).toHaveLength(0);
		expect(listMemberships(db, userId)).toStrictEqual([{ classId: 'cls-9a', source: 'sso' }]);
	});

	it('second login with unchanged claim → 0 / 0', async () => {
		expect.assertions(3);
		seedClass(db, {
			id: 'cls-9a',
			name: '9A',
			ssoProviderId: providerA,
			externalKey: 'CN=class-9A'
		});
		seedMembership(db, 'cls-9a', userId, 'sso');

		const result = await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: ['CN=class-9A'],
			now
		});

		expect(result.added).toHaveLength(0);
		expect(result.removed).toHaveLength(0);
		expect(listMemberships(db, userId)).toHaveLength(1);
	});

	it('claim removed → 0 / 1 (sso row deleted)', async () => {
		expect.assertions(3);
		seedClass(db, {
			id: 'cls-9a',
			name: '9A',
			ssoProviderId: providerA,
			externalKey: 'CN=class-9A'
		});
		seedMembership(db, 'cls-9a', userId, 'sso');

		const result = await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: [],
			now
		});

		expect(result.added).toHaveLength(0);
		expect(result.removed).toHaveLength(1);
		expect(listMemberships(db, userId)).toStrictEqual([]);
	});

	it('claim re-added after removal → 1 / 0', async () => {
		expect.assertions(2);
		seedClass(db, {
			id: 'cls-9a',
			name: '9A',
			ssoProviderId: providerA,
			externalKey: 'CN=class-9A'
		});

		await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: [],
			now
		});

		const result = await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: ['CN=class-9A'],
			now: now + 1000
		});

		expect(result.added).toHaveLength(1);
		expect(listMemberships(db, userId)).toStrictEqual([{ classId: 'cls-9a', source: 'sso' }]);
	});

	it('manual + sso in same class coexist; removing claim deletes only the sso row', async () => {
		expect.assertions(2);
		seedClass(db, {
			id: 'cls-9a',
			name: '9A',
			ssoProviderId: providerA,
			externalKey: 'CN=class-9A'
		});
		seedMembership(db, 'cls-9a', userId, 'manual');
		seedMembership(db, 'cls-9a', userId, 'sso');

		await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: [],
			now
		});

		const rows = listMemberships(db, userId);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toStrictEqual({ classId: 'cls-9a', source: 'manual' });
	});

	it("never touches another provider's classes", async () => {
		expect.assertions(2);
		const providerB = seedProvider(db, 'prov-b');
		seedClass(db, {
			id: 'cls-9a-a',
			name: '9A (A)',
			ssoProviderId: providerA,
			externalKey: 'CN=class-9A'
		});
		seedClass(db, {
			id: 'cls-9a-b',
			name: '9A (B)',
			ssoProviderId: providerB,
			externalKey: 'CN=class-9A'
		});
		seedMembership(db, 'cls-9a-b', userId, 'sso');

		// Provider A login with no claims must NOT touch the provider-B sso row.
		await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: [],
			now
		});

		const rows = listMemberships(db, userId);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toStrictEqual({ classId: 'cls-9a-b', source: 'sso' });
	});

	it('does not add membership to an archived class', async () => {
		expect.assertions(2);
		seedClass(db, {
			id: 'cls-old',
			name: '8B (archived)',
			ssoProviderId: providerA,
			externalKey: 'CN=class-8B',
			archivedAt: now - 86_400_000
		});

		const result = await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: ['CN=class-8B'],
			now
		});

		expect(result.added).toHaveLength(0);
		expect(listMemberships(db, userId)).toStrictEqual([]);
	});

	it('reports unmatched groups that have no class row', async () => {
		expect.assertions(2);
		seedClass(db, {
			id: 'cls-9a',
			name: '9A',
			ssoProviderId: providerA,
			externalKey: 'CN=class-9A'
		});

		const result = await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: ['CN=class-9A', 'CN=Cafeteria', 'CN=AllStaff'],
			now
		});

		expect(result.added).toHaveLength(1);
		expect(result.unmatchedGroups).toStrictEqual(['CN=AllStaff', 'CN=Cafeteria']);
	});

	it('ignores classes with null externalKey (manual classes) even if claimed somehow', async () => {
		expect.assertions(2);
		seedClass(db, {
			id: 'cls-manual',
			name: 'Manuelle Klasse',
			ssoProviderId: null,
			externalKey: null
		});

		const result = await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: ['Manuelle Klasse'],
			now
		});

		expect(result.added).toHaveLength(0);
		expect(listMemberships(db, userId)).toStrictEqual([]);
	});

	it('with no IdP-owned classes at all, never queries class_users or mutates', async () => {
		expect.assertions(2);
		// Provider has no classes configured.
		const result = await reconcileClassMembership(db, {
			userId,
			ssoProviderId: providerA,
			claimedGroups: ['CN=class-9A'],
			now
		});

		expect(result.added).toHaveLength(0);
		expect(listMemberships(db, userId)).toStrictEqual([]);
	});
});

describe('recordSeenGroups', () => {
	let db: Db;
	let now: number;
	let providerA: string;
	let userId: string;

	beforeEach(() => {
		({ db } = freshDb());
		now = 1_700_000_000_000;
		userId = seedUser(db, 'user-anna', 'anna@school.test');
		providerA = seedProvider(db, 'prov-a');
	});

	it('inserts a fresh row per (provider, externalKey)', async () => {
		expect.assertions(3);
		await recordSeenGroups(db, providerA, ['CN=class-9A', 'CN=Cafeteria'], userId, now);

		const rows = db.select().from(schema.idpGroupSeen).all();
		expect(rows).toHaveLength(2);
		const keys = rows.map((r) => r.externalKey).sort();
		expect(keys).toStrictEqual(['CN=Cafeteria', 'CN=class-9A']);
		expect(rows.every((r) => r.occurrenceCount === 1)).toBe(true);
	});

	it('upserts existing rows: bumps occurrenceCount, updates lastSeenAt, appends sample user', async () => {
		expect.assertions(4);
		await recordSeenGroups(db, providerA, ['CN=class-9A'], 'user-alice', now);
		await recordSeenGroups(db, providerA, ['CN=class-9A'], 'user-bob', now + 60_000);

		const [row] = db
			.select()
			.from(schema.idpGroupSeen)
			.where(
				and(
					eq(schema.idpGroupSeen.ssoProviderId, providerA),
					eq(schema.idpGroupSeen.externalKey, 'CN=class-9A')
				)
			)
			.all();
		expect(row.occurrenceCount).toBe(2);
		expect(row.lastSeenAt).toBe(now + 60_000);
		expect(row.firstSeenAt).toBe(now);
		expect(row.sampleUserIds).toStrictEqual(['user-alice', 'user-bob']);
	});

	it('caps sampleUserIds at 5 distinct values', async () => {
		expect.assertions(1);
		for (const u of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']) {
			await recordSeenGroups(db, providerA, ['CN=class-9A'], u, now);
		}
		const [row] = db.select().from(schema.idpGroupSeen).all();
		expect(row.sampleUserIds).toStrictEqual(['u1', 'u2', 'u3', 'u4', 'u5']);
	});

	it('is a no-op for an empty groups list', async () => {
		expect.assertions(1);
		await recordSeenGroups(db, providerA, [], userId, now);
		expect(db.select().from(schema.idpGroupSeen).all()).toHaveLength(0);
	});
});
