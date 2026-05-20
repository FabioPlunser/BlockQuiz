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
		demo integer DEFAULT 0 NOT NULL,
		archived_at integer,
		archived_by text,
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updatedAt integer DEFAULT (unixepoch() * 1000) NOT NULL,
		createdBy text NOT NULL
	)`,
	`CREATE TABLE IF NOT EXISTS exercises (
		id text PRIMARY KEY NOT NULL,
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
		category text DEFAULT 'user' NOT NULL,
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
	`CREATE INDEX IF NOT EXISTS achievements_user_idx ON achievements (user_id)`,
	`CREATE TABLE IF NOT EXISTS ssoProvider (
		id text PRIMARY KEY NOT NULL,
		issuer text NOT NULL,
		oidcConfig text,
		samlConfig text,
		userId text REFERENCES user(id) ON DELETE cascade,
		providerId text NOT NULL UNIQUE,
		organizationId text,
		domain text NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS ssoProvider_providerId_unique ON ssoProvider (providerId)`,
	`CREATE TABLE IF NOT EXISTS app_settings (
		key text PRIMARY KEY NOT NULL,
		value text NOT NULL,
		updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updated_by text REFERENCES user(id)
	)`,
	`CREATE TABLE IF NOT EXISTS classes (
		id text PRIMARY KEY NOT NULL,
		name text NOT NULL,
		description text,
		sso_provider_id text REFERENCES ssoProvider(id) ON DELETE SET NULL,
		external_key text,
		archived_at integer,
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		created_by text REFERENCES user(id) ON DELETE SET NULL
	)`,
	`CREATE INDEX IF NOT EXISTS classes_provider_external_idx ON classes (sso_provider_id, external_key)`,
	`CREATE INDEX IF NOT EXISTS classes_name_idx ON classes (name)`,
	`CREATE TABLE IF NOT EXISTS class_users (
		id text PRIMARY KEY NOT NULL,
		class_id text NOT NULL REFERENCES classes(id) ON DELETE cascade,
		user_id text NOT NULL REFERENCES user(id) ON DELETE cascade,
		source text DEFAULT 'manual' NOT NULL,
		added_by text REFERENCES user(id) ON DELETE SET NULL,
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS class_users_class_user_source_uq ON class_users (class_id, user_id, source)`,
	`CREATE INDEX IF NOT EXISTS class_users_user_idx ON class_users (user_id)`,
	`CREATE TABLE IF NOT EXISTS course_classes (
		id text PRIMARY KEY NOT NULL,
		course_id text NOT NULL REFERENCES courses(id) ON DELETE cascade,
		class_id text NOT NULL REFERENCES classes(id) ON DELETE cascade,
		added_by text REFERENCES user(id) ON DELETE SET NULL,
		created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS course_classes_course_class_uq ON course_classes (course_id, class_id)`,
	`CREATE INDEX IF NOT EXISTS course_classes_class_idx ON course_classes (class_id)`,
	`CREATE TABLE IF NOT EXISTS idp_group_seen (
		id text PRIMARY KEY NOT NULL,
		sso_provider_id text NOT NULL REFERENCES ssoProvider(id) ON DELETE cascade,
		external_key text NOT NULL,
		first_seen_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		last_seen_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
		occurrence_count integer DEFAULT 1 NOT NULL,
		sample_user_ids text DEFAULT '[]' NOT NULL
	)`,
	`CREATE UNIQUE INDEX IF NOT EXISTS idp_group_seen_provider_key_uq ON idp_group_seen (sso_provider_id, external_key)`
];

db.exec('PRAGMA foreign_keys = ON');

for (const statement of statements) {
	db.exec(statement);
}

// Idempotent ALTERs for columns added after initial table creation.
function ensureColumn(table: string, column: string, definition: string) {
	const rows = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
	if (!rows.some((r) => r.name === column)) {
		db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
	}
}

ensureColumn('audit_logs', 'category', `text DEFAULT 'user' NOT NULL`);
ensureColumn('courses', 'demo', `integer DEFAULT 0 NOT NULL`);

// Role 'author' was retired in favour of just teacher/admin/student. Re-map any
// existing rows so the runtime enum stays valid.
db.run(`UPDATE user SET role = 'teacher' WHERE role = 'author'`);

db.exec(`CREATE INDEX IF NOT EXISTS audit_logs_actor_ts_idx ON audit_logs (actor_user_id, ts)`);
db.exec(`CREATE INDEX IF NOT EXISTS audit_logs_category_ts_idx ON audit_logs (category, ts)`);
db.exec(`CREATE INDEX IF NOT EXISTS audit_logs_action_ts_idx ON audit_logs (action, ts)`);
db.exec(`CREATE INDEX IF NOT EXISTS audit_logs_ts_idx ON audit_logs (ts)`);

console.log(`Schema pushed to ${sqlitePath}`);
