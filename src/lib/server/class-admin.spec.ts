import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import * as schema from './db/schema';
import {
	addManualClassMembers,
	findProviderKeyConflict,
	removeClassMembersImpl,
	replaceCourseClasses,
	replaceManualClassMembers,
	replaceUserManualClasses,
	validateClassInput
} from './class-admin';

// Minimal DDL — just the tables needed for the class-admin helpers.
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
CREATE TABLE courses (
	id text PRIMARY KEY NOT NULL,
	content text NOT NULL,
	published integer NOT NULL DEFAULT 0,
	archived_at integer,
	archived_by text,
	created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
	updatedAt integer NOT NULL DEFAULT (unixepoch() * 1000),
	createdBy text NOT NULL
);
CREATE TABLE course_classes (
	id text PRIMARY KEY NOT NULL,
	course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
	class_id text NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
	added_by text REFERENCES user(id) ON DELETE SET NULL,
	created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
	updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
CREATE UNIQUE INDEX course_classes_course_class_uq ON course_classes (course_id, class_id);
`;

type Db = BunSQLiteDatabase<typeof schema>;

function freshDb(): Db {
	const raw = new Database(':memory:');
	raw.exec('PRAGMA foreign_keys = ON');
	raw.exec(DDL);
	return drizzle(raw, { schema });
}

function seedUser(db: Db, id: string) {
	db.insert(schema.user).values({ id, email: `${id}@test`, role: 'student', active: true }).run();
}
function seedProvider(db: Db, id: string) {
	db.insert(schema.ssoProvider)
		.values({ id, issuer: 'https://idp.test', providerId: id, domain: `${id}.test` })
		.run();
}
function seedClass(
	db: Db,
	id: string,
	opts: { ssoProviderId?: string | null; externalKey?: string | null; archivedAt?: number | null } = {}
) {
	db.insert(schema.classes)
		.values({
			id,
			name: id,
			ssoProviderId: opts.ssoProviderId ?? null,
			externalKey: opts.externalKey ?? null,
			archivedAt: opts.archivedAt ?? null
		})
		.run();
}
function seedMembership(db: Db, classId: string, userId: string, source: 'sso' | 'manual') {
	db.insert(schema.classUsers)
		.values({ id: crypto.randomUUID(), classId, userId, source })
		.run();
}
function listMembers(db: Db, classId: string) {
	return db
		.select({ userId: schema.classUsers.userId, source: schema.classUsers.source })
		.from(schema.classUsers)
		.where(eq(schema.classUsers.classId, classId))
		.all();
}

describe('validateClassInput', () => {
	it('rejects when name is missing or whitespace only', () => {
		expect.assertions(2);
		expect(validateClassInput({ name: '' }).ok).toBe(false);
		expect(validateClassInput({ name: '   ' }).ok).toBe(false);
	});

	it('accepts a manual class (both provider and key blank)', () => {
		expect.assertions(2);
		const result = validateClassInput({ name: '9A', description: 'Lab class' });
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toStrictEqual({
				name: '9A',
				description: 'Lab class',
				ssoProviderId: null,
				externalKey: null
			});
		}
	});

	it('accepts an IdP-owned class with both provider and key set', () => {
		expect.assertions(2);
		const result = validateClassInput({
			name: '9A',
			ssoProviderId: 'prov-a',
			externalKey: 'CN=class-9A'
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.ssoProviderId).toBe('prov-a');
		}
	});

	it('rejects when only provider is set', () => {
		expect.assertions(2);
		const result = validateClassInput({ name: '9A', ssoProviderId: 'prov-a' });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toMatch(/together/i);
	});

	it('rejects when only externalKey is set', () => {
		expect.assertions(1);
		const result = validateClassInput({ name: '9A', externalKey: 'CN=class-9A' });
		expect(result.ok).toBe(false);
	});

	it('normalises whitespace: trims name, description, keys', () => {
		expect.assertions(1);
		const result = validateClassInput({
			name: '  9A  ',
			description: '  desc  ',
			ssoProviderId: '  prov-a  ',
			externalKey: '  CN=x  '
		});
		expect(result.ok && result.value).toStrictEqual({
			name: '9A',
			description: 'desc',
			ssoProviderId: 'prov-a',
			externalKey: 'CN=x'
		});
	});
});

describe('findProviderKeyConflict', () => {
	let db: Db;
	beforeEach(() => {
		db = freshDb();
		seedProvider(db, 'prov-a');
		seedProvider(db, 'prov-b');
	});

	it('returns null when no class with this (provider, key) exists', async () => {
		expect.assertions(1);
		expect(await findProviderKeyConflict(db, 'prov-a', 'CN=class-9A')).toBeNull();
	});

	it('returns the conflicting class id when one exists', async () => {
		expect.assertions(1);
		seedClass(db, 'cls-9a', { ssoProviderId: 'prov-a', externalKey: 'CN=class-9A' });
		expect(await findProviderKeyConflict(db, 'prov-a', 'CN=class-9A')).toBe('cls-9a');
	});

	it('excludes the row being edited (so a save of the same row is not a conflict)', async () => {
		expect.assertions(1);
		seedClass(db, 'cls-9a', { ssoProviderId: 'prov-a', externalKey: 'CN=class-9A' });
		expect(await findProviderKeyConflict(db, 'prov-a', 'CN=class-9A', 'cls-9a')).toBeNull();
	});

	it('does not consider an archived class a conflict', async () => {
		expect.assertions(1);
		seedClass(db, 'cls-archived', {
			ssoProviderId: 'prov-a',
			externalKey: 'CN=class-9A',
			archivedAt: 1_000_000
		});
		expect(await findProviderKeyConflict(db, 'prov-a', 'CN=class-9A')).toBeNull();
	});

	it('same key under a different provider is not a conflict', async () => {
		expect.assertions(1);
		seedClass(db, 'cls-a', { ssoProviderId: 'prov-a', externalKey: 'CN=class-9A' });
		expect(await findProviderKeyConflict(db, 'prov-b', 'CN=class-9A')).toBeNull();
	});
});

describe('addManualClassMembers', () => {
	let db: Db;
	beforeEach(() => {
		db = freshDb();
		seedUser(db, 'admin');
		seedUser(db, 'alice');
		seedUser(db, 'bob');
		seedUser(db, 'carol');
		seedClass(db, 'cls-9a');
	});

	it('is a no-op for an empty userIds list', async () => {
		expect.assertions(2);
		const result = await addManualClassMembers(db, 'cls-9a', [], 'admin', 0);
		expect(result.added).toBe(0);
		expect(listMembers(db, 'cls-9a')).toHaveLength(0);
	});

	it('adds new members with source=manual', async () => {
		expect.assertions(3);
		const result = await addManualClassMembers(db, 'cls-9a', ['alice', 'bob'], 'admin', 0);
		expect(result.added).toBe(2);
		const rows = listMembers(db, 'cls-9a');
		expect(rows).toHaveLength(2);
		expect(rows.every((r) => r.source === 'manual')).toBe(true);
	});

	it('is idempotent: re-adding an existing manual member does nothing', async () => {
		expect.assertions(2);
		await addManualClassMembers(db, 'cls-9a', ['alice'], 'admin', 0);
		const result = await addManualClassMembers(db, 'cls-9a', ['alice', 'bob'], 'admin', 0);
		expect(result.added).toBe(1);
		expect(listMembers(db, 'cls-9a')).toHaveLength(2);
	});

	it('coexists with an existing source=sso row for the same user', async () => {
		expect.assertions(2);
		seedMembership(db, 'cls-9a', 'alice', 'sso');
		const result = await addManualClassMembers(db, 'cls-9a', ['alice'], 'admin', 0);
		expect(result.added).toBe(1);
		const rows = listMembers(db, 'cls-9a');
		expect(rows.map((r) => r.source).sort()).toStrictEqual(['manual', 'sso']);
	});
});

describe('replaceCourseClasses', () => {
	let db: Db;
	beforeEach(() => {
		db = freshDb();
		seedUser(db, 'teacher');
		db.insert(schema.courses)
			.values({ id: 'course-1', content: { en: 'C' }, published: true, createdBy: 'teacher' })
			.run();
		seedClass(db, 'cls-9a');
		seedClass(db, 'cls-9b');
		seedClass(db, 'cls-9c');
	});

	function listCourseClasses(courseId: string): string[] {
		return db
			.select({ classId: schema.courseClasses.classId })
			.from(schema.courseClasses)
			.where(eq(schema.courseClasses.courseId, courseId))
			.all()
			.map((r) => r.classId)
			.sort();
	}

	it('inserts every classId on first call', async () => {
		expect.assertions(2);
		const result = await replaceCourseClasses(db, 'course-1', ['cls-9a', 'cls-9b'], 'teacher', 0);
		expect(result.inserted).toBe(2);
		expect(listCourseClasses('course-1')).toStrictEqual(['cls-9a', 'cls-9b']);
	});

	it('wipes existing rows before inserting the new set', async () => {
		expect.assertions(2);
		await replaceCourseClasses(db, 'course-1', ['cls-9a', 'cls-9b'], 'teacher', 0);
		const result = await replaceCourseClasses(db, 'course-1', ['cls-9b', 'cls-9c'], 'teacher', 0);
		expect(result.inserted).toBe(2);
		expect(listCourseClasses('course-1')).toStrictEqual(['cls-9b', 'cls-9c']);
	});

	it('clears all class links when called with an empty array', async () => {
		expect.assertions(2);
		await replaceCourseClasses(db, 'course-1', ['cls-9a', 'cls-9b'], 'teacher', 0);
		const result = await replaceCourseClasses(db, 'course-1', [], 'teacher', 0);
		expect(result.inserted).toBe(0);
		expect(listCourseClasses('course-1')).toStrictEqual([]);
	});

	it('is idempotent when called twice with the same set', async () => {
		expect.assertions(2);
		await replaceCourseClasses(db, 'course-1', ['cls-9a'], 'teacher', 0);
		await replaceCourseClasses(db, 'course-1', ['cls-9a'], 'teacher', 0);
		expect(listCourseClasses('course-1')).toStrictEqual(['cls-9a']);
		// Confirm the unique index doesn't double-insert when the wipe+insert cycle runs.
		const allRows = db.select().from(schema.courseClasses).all();
		expect(allRows).toHaveLength(1);
	});
});

describe('removeClassMembersImpl', () => {
	let db: Db;
	beforeEach(() => {
		db = freshDb();
		seedUser(db, 'alice');
		seedUser(db, 'bob');
		seedClass(db, 'cls-9a');
	});

	it('is a no-op for an empty userIds list', async () => {
		expect.assertions(1);
		const result = await removeClassMembersImpl(db, 'cls-9a', [], false);
		expect(result.removed).toBe(0);
	});

	it("removes only source='manual' rows by default", async () => {
		expect.assertions(2);
		seedMembership(db, 'cls-9a', 'alice', 'manual');
		seedMembership(db, 'cls-9a', 'alice', 'sso');
		const result = await removeClassMembersImpl(db, 'cls-9a', ['alice'], false);
		expect(result.removed).toBe(1);
		expect(listMembers(db, 'cls-9a')).toStrictEqual([{ userId: 'alice', source: 'sso' }]);
	});

	it("force=true also removes source='sso' rows", async () => {
		expect.assertions(2);
		seedMembership(db, 'cls-9a', 'alice', 'manual');
		seedMembership(db, 'cls-9a', 'alice', 'sso');
		const result = await removeClassMembersImpl(db, 'cls-9a', ['alice'], true);
		expect(result.removed).toBe(2);
		expect(listMembers(db, 'cls-9a')).toHaveLength(0);
	});

	it('only touches the specified userIds', async () => {
		expect.assertions(2);
		seedMembership(db, 'cls-9a', 'alice', 'manual');
		seedMembership(db, 'cls-9a', 'bob', 'manual');
		const result = await removeClassMembersImpl(db, 'cls-9a', ['alice'], false);
		expect(result.removed).toBe(1);
		expect(listMembers(db, 'cls-9a')).toStrictEqual([{ userId: 'bob', source: 'manual' }]);
	});

	it('returns 0 when no matching rows exist (without force)', async () => {
		expect.assertions(2);
		seedMembership(db, 'cls-9a', 'alice', 'sso');
		const result = await removeClassMembersImpl(db, 'cls-9a', ['alice'], false);
		expect(result.removed).toBe(0);
		expect(listMembers(db, 'cls-9a')).toHaveLength(1);
	});
});

describe('replaceUserManualClasses', () => {
	let db: Db;
	beforeEach(() => {
		db = freshDb();
		seedUser(db, 'admin');
		seedUser(db, 'alice');
		seedUser(db, 'bob');
		seedClass(db, 'cls-9a');
		seedClass(db, 'cls-9b');
		seedClass(db, 'cls-9c');
	});

	function listForUser(userId: string) {
		return db
			.select({ classId: schema.classUsers.classId, source: schema.classUsers.source })
			.from(schema.classUsers)
			.where(eq(schema.classUsers.userId, userId))
			.all();
	}

	it('inserts manual rows for every target classId on first call', async () => {
		expect.assertions(2);
		const result = await replaceUserManualClasses(
			db,
			'alice',
			['cls-9a', 'cls-9b'],
			'admin',
			0
		);
		expect(result).toMatchObject({ added: 2, removed: 0 });
		expect(listForUser('alice').map((r) => r.classId).sort()).toStrictEqual([
			'cls-9a',
			'cls-9b'
		]);
	});

	it('diffs additions and removals against the current manual set', async () => {
		expect.assertions(2);
		await replaceUserManualClasses(db, 'alice', ['cls-9a', 'cls-9b'], 'admin', 0);
		const result = await replaceUserManualClasses(db, 'alice', ['cls-9b', 'cls-9c'], 'admin', 0);
		expect(result).toMatchObject({ added: 1, removed: 1 });
		expect(listForUser('alice').map((r) => r.classId).sort()).toStrictEqual([
			'cls-9b',
			'cls-9c'
		]);
	});

	it('empty target removes all manual rows for the user', async () => {
		expect.assertions(2);
		await replaceUserManualClasses(db, 'alice', ['cls-9a'], 'admin', 0);
		const result = await replaceUserManualClasses(db, 'alice', [], 'admin', 0);
		expect(result).toMatchObject({ added: 0, removed: 1 });
		expect(listForUser('alice')).toStrictEqual([]);
	});

	it("never touches source='sso' rows", async () => {
		expect.assertions(2);
		seedMembership(db, 'cls-9a', 'alice', 'sso');
		seedMembership(db, 'cls-9b', 'alice', 'sso');
		const result = await replaceUserManualClasses(db, 'alice', [], 'admin', 0);
		expect(result).toMatchObject({ added: 0, removed: 0 });
		expect(listForUser('alice').map((r) => r.source).sort()).toStrictEqual(['sso', 'sso']);
	});

	it('allows manual + sso to coexist for the same (user, class) pair', async () => {
		expect.assertions(2);
		seedMembership(db, 'cls-9a', 'alice', 'sso');
		const result = await replaceUserManualClasses(db, 'alice', ['cls-9a'], 'admin', 0);
		expect(result).toMatchObject({ added: 1, removed: 0 });
		expect(listForUser('alice').map((r) => r.source).sort()).toStrictEqual(['manual', 'sso']);
	});

	it("does not touch other users' rows", async () => {
		expect.assertions(2);
		await replaceUserManualClasses(db, 'bob', ['cls-9a'], 'admin', 0);
		await replaceUserManualClasses(db, 'alice', ['cls-9b'], 'admin', 0);
		expect(listForUser('alice').map((r) => r.classId)).toStrictEqual(['cls-9b']);
		expect(listForUser('bob').map((r) => r.classId)).toStrictEqual(['cls-9a']);
	});
});

describe('replaceManualClassMembers', () => {
	let db: Db;
	beforeEach(() => {
		db = freshDb();
		seedUser(db, 'admin');
		seedUser(db, 'alice');
		seedUser(db, 'bob');
		seedUser(db, 'carol');
		seedClass(db, 'cls-9a');
		seedClass(db, 'cls-9b');
	});

	function listForClass(classId: string) {
		return db
			.select({ userId: schema.classUsers.userId, source: schema.classUsers.source })
			.from(schema.classUsers)
			.where(eq(schema.classUsers.classId, classId))
			.all();
	}

	it('inserts manual rows for every target userId on first call', async () => {
		expect.assertions(2);
		const result = await replaceManualClassMembers(
			db,
			'cls-9a',
			['alice', 'bob'],
			'admin',
			0
		);
		expect(result).toMatchObject({ added: 2, removed: 0 });
		expect(listForClass('cls-9a').map((r) => r.userId).sort()).toStrictEqual(['alice', 'bob']);
	});

	it('diffs additions and removals against the current manual set', async () => {
		expect.assertions(2);
		await replaceManualClassMembers(db, 'cls-9a', ['alice', 'bob'], 'admin', 0);
		const result = await replaceManualClassMembers(db, 'cls-9a', ['bob', 'carol'], 'admin', 0);
		expect(result).toMatchObject({ added: 1, removed: 1 });
		expect(listForClass('cls-9a').map((r) => r.userId).sort()).toStrictEqual(['bob', 'carol']);
	});

	it('empty target removes all manual rows for the class', async () => {
		expect.assertions(2);
		await replaceManualClassMembers(db, 'cls-9a', ['alice'], 'admin', 0);
		const result = await replaceManualClassMembers(db, 'cls-9a', [], 'admin', 0);
		expect(result).toMatchObject({ added: 0, removed: 1 });
		expect(listForClass('cls-9a')).toStrictEqual([]);
	});

	it("never touches source='sso' rows", async () => {
		expect.assertions(2);
		seedMembership(db, 'cls-9a', 'alice', 'sso');
		seedMembership(db, 'cls-9a', 'bob', 'sso');
		const result = await replaceManualClassMembers(db, 'cls-9a', [], 'admin', 0);
		expect(result).toMatchObject({ added: 0, removed: 0 });
		expect(listForClass('cls-9a').map((r) => r.source).sort()).toStrictEqual(['sso', 'sso']);
	});

	it("does not touch other classes' rows", async () => {
		expect.assertions(2);
		await replaceManualClassMembers(db, 'cls-9b', ['alice'], 'admin', 0);
		await replaceManualClassMembers(db, 'cls-9a', ['bob'], 'admin', 0);
		expect(listForClass('cls-9a').map((r) => r.userId)).toStrictEqual(['bob']);
		expect(listForClass('cls-9b').map((r) => r.userId)).toStrictEqual(['alice']);
	});
});

describe('SSO-owned class guards', () => {
	let db: Db;
	beforeEach(() => {
		db = freshDb();
		seedUser(db, 'admin');
		seedUser(db, 'alice');
		seedProvider(db, 'prov-a');
		// Manual class — admins can edit.
		seedClass(db, 'cls-manual');
		// IdP-owned class — neither helper should be able to add manual rows.
		seedClass(db, 'cls-idp', { ssoProviderId: 'prov-a', externalKey: 'CN=class-9A' });
	});

	function membershipsForUser(userId: string) {
		return db
			.select({ classId: schema.classUsers.classId, source: schema.classUsers.source })
			.from(schema.classUsers)
			.where(eq(schema.classUsers.userId, userId))
			.all();
	}

	it('replaceUserManualClasses filters IdP-owned IDs out of the target', async () => {
		expect.assertions(3);
		const result = await replaceUserManualClasses(
			db,
			'alice',
			['cls-manual', 'cls-idp'],
			'admin',
			0
		);
		expect(result.added).toBe(1);
		expect(result.rejected).toStrictEqual(['cls-idp']);
		expect(membershipsForUser('alice')).toStrictEqual([
			{ classId: 'cls-manual', source: 'manual' }
		]);
	});

	it('replaceUserManualClasses rejects an all-IdP target without errors', async () => {
		expect.assertions(2);
		const result = await replaceUserManualClasses(db, 'alice', ['cls-idp'], 'admin', 0);
		expect(result).toMatchObject({ added: 0, removed: 0 });
		expect(result.rejected).toStrictEqual(['cls-idp']);
	});

	it('replaceManualClassMembers refuses to operate on an IdP-owned class', async () => {
		expect.assertions(3);
		const result = await replaceManualClassMembers(db, 'cls-idp', ['alice'], 'admin', 0);
		expect(result.rejected).toBe(true);
		expect(result).toMatchObject({ added: 0, removed: 0 });
		expect(membershipsForUser('alice')).toStrictEqual([]);
	});

	it('replaceManualClassMembers works as normal on a manual class', async () => {
		expect.assertions(2);
		const result = await replaceManualClassMembers(db, 'cls-manual', ['alice'], 'admin', 0);
		expect(result).toMatchObject({ added: 1, removed: 0, rejected: false });
		expect(membershipsForUser('alice')).toStrictEqual([
			{ classId: 'cls-manual', source: 'manual' }
		]);
	});

	it('returns rejected=false (empty array) when the target has no IdP IDs', async () => {
		expect.assertions(1);
		const result = await replaceUserManualClasses(db, 'alice', ['cls-manual'], 'admin', 0);
		expect(result.rejected).toStrictEqual([]);
	});
});
