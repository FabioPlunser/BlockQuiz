import { Database } from 'bun:sqlite';

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const sqlitePath = process.env.DATABASE_URL.replace(/^file:/, '');
const db = new Database(sqlitePath);

const statements = [
	`CREATE TABLE IF NOT EXISTS user (
		id text PRIMARY KEY NOT NULL,
		name text,
		email text NOT NULL UNIQUE,
		emailVerified integer DEFAULT 0 NOT NULL,
		image text,
		createdAt integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updatedAt integer DEFAULT (unixepoch() * 1000) NOT NULL,
		role text DEFAULT 'student' NOT NULL,
		active integer DEFAULT 1 NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON user (email)`,
	`CREATE TABLE IF NOT EXISTS session (
		id text PRIMARY KEY NOT NULL,
		expiresAt integer NOT NULL,
		token text NOT NULL UNIQUE,
		createdAt integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updatedAt integer DEFAULT (unixepoch() * 1000) NOT NULL,
		ipAddress text,
		userAgent text,
		userId text NOT NULL REFERENCES user(id) ON DELETE cascade
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS session_token_unique ON session (token)`,
	`CREATE TABLE IF NOT EXISTS account (
		id text PRIMARY KEY NOT NULL,
		accountId text NOT NULL,
		providerId text NOT NULL,
		userId text NOT NULL REFERENCES user(id) ON DELETE cascade,
		accessToken text,
		refreshToken text,
		idToken text,
		accessTokenExpiresAt integer,
		refreshTokenExpiresAt integer,
		scope text,
		password text,
		createdAt integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updatedAt integer DEFAULT (unixepoch() * 1000) NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS verification (
		id text PRIMARY KEY NOT NULL,
		identifier text NOT NULL,
		value text NOT NULL,
		expiresAt integer NOT NULL,
		createdAt integer DEFAULT (unixepoch() * 1000),
		updatedAt integer DEFAULT (unixepoch() * 1000)
	)`,
	`CREATE TABLE IF NOT EXISTS courses (
		id text PRIMARY KEY NOT NULL,
		content text NOT NULL,
		published integer DEFAULT 0 NOT NULL,
		archived_at integer,
		archived_by text,
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updatedAt integer DEFAULT (unixepoch() * 1000) NOT NULL,
		createdBy text NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS exercises (
		id text PRIMARY KEY NOT NULL,
		course_id text NOT NULL REFERENCES courses(id) ON DELETE cascade,
		type text NOT NULL,
		image text,
		content text NOT NULL,
		config text NOT NULL,
		validation_json text DEFAULT '{"valid":false,"issues":[]}' NOT NULL,
		published integer DEFAULT 0 NOT NULL,
		archived_at integer,
		archived_by text REFERENCES user(id),
		"order" integer DEFAULT 0 NOT NULL,
		created_by text NOT NULL REFERENCES user(id),
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS course_exercises (
		id text PRIMARY KEY NOT NULL,
		course_id text NOT NULL REFERENCES courses(id) ON DELETE cascade,
		exercise_id text NOT NULL REFERENCES exercises(id) ON DELETE cascade,
		"order" integer DEFAULT 0 NOT NULL,
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS course_users (
		id text PRIMARY KEY NOT NULL,
		course_id text NOT NULL REFERENCES courses(id) ON DELETE cascade,
		user_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS exercise_versions (
		id text PRIMARY KEY NOT NULL,
		exercise_id text NOT NULL REFERENCES exercises(id) ON DELETE cascade,
		snapshot_json text NOT NULL,
		message text,
		created_by text,
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS attempts (
		id text PRIMARY KEY NOT NULL,
		exercise_id text NOT NULL REFERENCES exercises(id) ON DELETE cascade,
		user_id text REFERENCES user(id),
		client_id text,
		actor_type text DEFAULT 'user' NOT NULL CHECK (actor_type IN ('user', 'guest')),
		workspace_xml text DEFAULT '' NOT NULL,
		generated_code text DEFAULT '' NOT NULL,
		result_json text NOT NULL,
		locale text DEFAULT 'de' NOT NULL,
		started_at integer NOT NULL,
		ended_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		score integer DEFAULT 0 NOT NULL,
		passed integer DEFAULT 0 NOT NULL,
		hint_events_json text DEFAULT '[]' NOT NULL,
		analytics_json text DEFAULT '{}' NOT NULL,
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		CHECK (
			(actor_type = 'user' AND user_id IS NOT NULL AND client_id IS NULL)
			OR (actor_type = 'guest' AND user_id IS NULL AND client_id IS NOT NULL)
		)
	)`,
	`CREATE TABLE IF NOT EXISTS audit_logs (
		id text PRIMARY KEY NOT NULL,
		ts integer DEFAULT (unixepoch() * 1000) NOT NULL,
		actor_user_id text REFERENCES user(id),
		action text NOT NULL,
		details_json text
	)`,
	`CREATE TABLE IF NOT EXISTS translations (
		id text PRIMARY KEY NOT NULL,
		locale text NOT NULL,
		"key" text NOT NULL,
		value text NOT NULL,
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS achievements (
		id text PRIMARY KEY NOT NULL,
		user_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
		badge_key text NOT NULL,
		awarded_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		context_json text
	)`,
	`CREATE INDEX IF NOT EXISTS achievements_user_idx ON achievements (user_id)`
];

db.exec('PRAGMA foreign_keys = ON');

for (const statement of statements) {
	db.exec(statement);
}

console.log(`Schema pushed to ${sqlitePath}`);
