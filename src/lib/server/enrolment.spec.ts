import { Database } from 'bun:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';

import * as schema from './db/schema';

// Minimal DDL: just the tables involved in enrolment checks.
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
  providerId text NOT NULL UNIQUE,
  domain text NOT NULL
);
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
CREATE TABLE course_users (
  id text PRIMARY KEY NOT NULL,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
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
CREATE TABLE course_classes (
  id text PRIMARY KEY NOT NULL,
  course_id text NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  class_id text NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  added_by text REFERENCES user(id) ON DELETE SET NULL,
  created_at integer NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at integer NOT NULL DEFAULT (unixepoch() * 1000)
);
`;

type Db = BunSQLiteDatabase<typeof schema>;

function freshDb(): Db {
	const raw = new Database(':memory:');
	raw.exec('PRAGMA foreign_keys = ON');
	raw.exec(DDL);
	return drizzle(raw, { schema });
}

// The helper imports `db` from `$lib/server/db/client`. We mock that module to
// point at our in-memory db so we can exercise the real query logic without
// touching the real file-backed SQLite.
let testDb: Db;
vi.mock('$lib/server/db/client', () => ({
	get db() {
		return testDb;
	}
}));

// Import AFTER the mock is registered so it picks up our stub.
const { getEnrolledCourseIds, isEnrolledInCourse } = await import('./enrolment');

function seedUser(db: Db, id: string) {
	db.insert(schema.user).values({ id, email: `${id}@test`, role: 'student', active: true }).run();
}
function seedCourse(db: Db, id: string) {
	db.insert(schema.courses)
		.values({ id, content: { en: id }, published: true, createdBy: 'seed' })
		.run();
}
function seedClass(db: Db, id: string, opts: { archivedAt?: number | null } = {}) {
	db.insert(schema.classes).values({ id, name: id, archivedAt: opts.archivedAt ?? null }).run();
}
function enrolDirect(db: Db, courseId: string, userId: string) {
	db.insert(schema.courseUsers)
		.values({ id: crypto.randomUUID(), courseId, userId })
		.run();
}
function addToClass(db: Db, classId: string, userId: string) {
	db.insert(schema.classUsers)
		.values({ id: crypto.randomUUID(), classId, userId, source: 'manual' })
		.run();
}
function linkClassToCourse(db: Db, courseId: string, classId: string) {
	db.insert(schema.courseClasses)
		.values({ id: crypto.randomUUID(), courseId, classId })
		.run();
}

describe('getEnrolledCourseIds', () => {
	beforeEach(() => {
		testDb = freshDb();
	});

	it('returns empty set for a user with no enrolments', async () => {
		expect.assertions(1);
		seedUser(testDb, 'u1');
		expect(await getEnrolledCourseIds('u1')).toStrictEqual(new Set());
	});

	it('returns courses assigned directly', async () => {
		expect.assertions(1);
		seedUser(testDb, 'u1');
		seedCourse(testDb, 'c1');
		seedCourse(testDb, 'c2');
		enrolDirect(testDb, 'c1', 'u1');
		expect(await getEnrolledCourseIds('u1')).toStrictEqual(new Set(['c1']));
	});

	it('returns courses reached via class membership', async () => {
		expect.assertions(1);
		seedUser(testDb, 'u1');
		seedCourse(testDb, 'c1');
		seedClass(testDb, 'cls-9a');
		addToClass(testDb, 'cls-9a', 'u1');
		linkClassToCourse(testDb, 'c1', 'cls-9a');
		expect(await getEnrolledCourseIds('u1')).toStrictEqual(new Set(['c1']));
	});

	it('dedupes courses reached via both paths', async () => {
		expect.assertions(2);
		seedUser(testDb, 'u1');
		seedCourse(testDb, 'c1');
		seedClass(testDb, 'cls-9a');
		addToClass(testDb, 'cls-9a', 'u1');
		linkClassToCourse(testDb, 'c1', 'cls-9a');
		enrolDirect(testDb, 'c1', 'u1');

		const ids = await getEnrolledCourseIds('u1');
		expect(ids.size).toBe(1);
		expect(ids).toStrictEqual(new Set(['c1']));
	});

	it('excludes archived classes', async () => {
		expect.assertions(1);
		seedUser(testDb, 'u1');
		seedCourse(testDb, 'c1');
		seedClass(testDb, 'cls-old', { archivedAt: 1_000_000 });
		addToClass(testDb, 'cls-old', 'u1');
		linkClassToCourse(testDb, 'c1', 'cls-old');
		expect(await getEnrolledCourseIds('u1')).toStrictEqual(new Set());
	});

	it('does not bleed enrolments across users', async () => {
		expect.assertions(2);
		seedUser(testDb, 'u1');
		seedUser(testDb, 'u2');
		seedCourse(testDb, 'c1');
		seedCourse(testDb, 'c2');
		seedClass(testDb, 'cls-a');
		addToClass(testDb, 'cls-a', 'u1');
		linkClassToCourse(testDb, 'c1', 'cls-a');
		enrolDirect(testDb, 'c2', 'u2');

		expect(await getEnrolledCourseIds('u1')).toStrictEqual(new Set(['c1']));
		expect(await getEnrolledCourseIds('u2')).toStrictEqual(new Set(['c2']));
	});
});

describe('isEnrolledInCourse', () => {
	beforeEach(() => {
		testDb = freshDb();
	});

	it('true when directly enrolled', async () => {
		expect.assertions(1);
		seedUser(testDb, 'u1');
		seedCourse(testDb, 'c1');
		enrolDirect(testDb, 'c1', 'u1');
		expect(await isEnrolledInCourse('u1', 'c1')).toBe(true);
	});

	it('true when reached via class', async () => {
		expect.assertions(1);
		seedUser(testDb, 'u1');
		seedCourse(testDb, 'c1');
		seedClass(testDb, 'cls-a');
		addToClass(testDb, 'cls-a', 'u1');
		linkClassToCourse(testDb, 'c1', 'cls-a');
		expect(await isEnrolledInCourse('u1', 'c1')).toBe(true);
	});

	it('false when not enrolled by any path', async () => {
		expect.assertions(1);
		seedUser(testDb, 'u1');
		seedCourse(testDb, 'c1');
		expect(await isEnrolledInCourse('u1', 'c1')).toBe(false);
	});

	it('false when the only path is via an archived class', async () => {
		expect.assertions(1);
		seedUser(testDb, 'u1');
		seedCourse(testDb, 'c1');
		seedClass(testDb, 'cls-old', { archivedAt: 1_000_000 });
		addToClass(testDb, 'cls-old', 'u1');
		linkClassToCourse(testDb, 'c1', 'cls-old');
		expect(await isEnrolledInCourse('u1', 'c1')).toBe(false);
	});
});
