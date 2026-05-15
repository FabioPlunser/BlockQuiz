import { sqliteTable, integer, text, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const nowMs = () => sql`(unixepoch() * 1000)`;

// Better Auth required tables
export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name'),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
	image: text('image'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(nowMs()),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(nowMs()),
	role: text('role', { enum: ['student', 'teacher', 'author', 'admin'] })
		.notNull()
		.default('student'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true)
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(nowMs()),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(nowMs()),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' })
});

export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('accessToken'),
	refreshToken: text('refreshToken'),
	idToken: text('idToken'),
	accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('createdAt', { mode: 'timestamp' }).notNull().default(nowMs()),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(nowMs())
});

export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }).default(nowMs()),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).default(nowMs())
});

// Better Auth SSO plugin (@better-auth/sso)
export const ssoProvider = sqliteTable('ssoProvider', {
	id: text('id').primaryKey(),
	issuer: text('issuer').notNull(),
	oidcConfig: text('oidcConfig'),
	samlConfig: text('samlConfig'),
	userId: text('userId').references(() => user.id, { onDelete: 'cascade' }),
	providerId: text('providerId').notNull().unique(),
	organizationId: text('organizationId'),
	domain: text('domain').notNull()
});

// Courses table
export const courses = sqliteTable('courses', {
	id: text('id').primaryKey(),
	content: text('content', { mode: 'json' }).notNull(),
	published: integer('published', { mode: 'boolean' }).notNull().default(false),
	archivedAt: integer('archived_at', { mode: 'number' }),
	archivedBy: text('archived_by'),
	createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
	updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull().default(nowMs()),
	createdBy: text('createdBy').notNull()
});

export const courseExercises = sqliteTable('course_exercises', {
	id: text('id').primaryKey(),
	courseId: text('course_id')
		.notNull()
		.references(() => courses.id, { onDelete: 'cascade' }),
	exerciseId: text('exercise_id')
		.notNull()
		.references(() => exercises.id, { onDelete: 'cascade' }),
	// Order within this specific course
	order: integer('order', { mode: 'number' }).notNull().default(0),
	createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
	updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs())
});

export const courseUsers = sqliteTable('course_users', {
	id: text('id').primaryKey(),
	courseId: text('course_id')
		.notNull()
		.references(() => courses.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
	updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs())
});

// Exercises table
export const exercises = sqliteTable('exercises', {
	id: text('id').primaryKey(),
	courseId: text('course_id')
		.notNull()
		.references(() => courses.id, { onDelete: 'cascade' }),
	type: text('type', { enum: ['io', 'turtle', 'robot'] }).notNull(),
	image: text('image'),
	content: text('content', { mode: 'json' }).notNull(),
	config: text('config', { mode: 'json' }).notNull(),
	validationJson: text('validation_json', { mode: 'json' })
		.notNull()
		.default('{"valid":false,"issues":[]}'),
	published: integer('published', { mode: 'boolean' }).notNull().default(false),
	archivedAt: integer('archived_at', { mode: 'number' }),
	archivedBy: text('archived_by').references(() => user.id),
	order: integer('order', { mode: 'number' }).notNull().default(0),
	createdBy: text('created_by')
		.notNull()
		.references(() => user.id),
	createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
	updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs())
});

// Exercise versions table
export const exerciseVersions = sqliteTable('exercise_versions', {
	id: text('id').primaryKey(),
	exerciseId: text('exercise_id')
		.notNull()
		.references(() => exercises.id, { onDelete: 'cascade' }),
	snapshotJson: text('snapshot_json').notNull(),
	message: text('message'),
	createdBy: text('created_by'),
	createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs())
});

// Attempts table
export const attempts = sqliteTable(
	'attempts',
	{
		id: text('id').primaryKey(),
		exerciseId: text('exercise_id')
			.notNull()
			.references(() => exercises.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => user.id),
		clientId: text('client_id'),
		actorType: text('actor_type', { enum: ['user', 'guest'] })
			.notNull()
			.default('user'),
		workspaceXml: text('workspace_xml').notNull().default(''),
		generatedCode: text('generated_code').notNull().default(''),
		resultJson: text('result_json').notNull(),
		locale: text('locale', { enum: ['de', 'en'] })
			.notNull()
			.default('de'),
		startedAt: integer('started_at', { mode: 'number' }).notNull(),
		endedAt: integer('ended_at', { mode: 'number' }).notNull().default(nowMs()),
		score: integer('score').notNull().default(0),
		passed: integer('passed', { mode: 'boolean' }).notNull().default(false),
		hintEventsJson: text('hint_events_json').notNull().default('[]'),
		analyticsJson: text('analytics_json').notNull().default('{}'),
		createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs())
	},
	(table) => [
		check(
			'attempt_actor_check',
			sql`(${table.actorType} = 'user' AND ${table.userId} IS NOT NULL AND ${table.clientId} IS NULL) OR (${table.actorType} = 'guest' AND ${table.userId} IS NULL AND ${table.clientId} IS NOT NULL)`
		)
	]
);

// Audit logs table
export const auditLogs = sqliteTable('audit_logs', {
	id: text('id').primaryKey(),
	ts: integer('ts', { mode: 'number' }).notNull().default(nowMs()),
	actorUserId: text('actor_user_id').references(() => user.id),
	action: text('action').notNull(),
	detailsJson: text('details_json')
});

// Achievement badges earned by authenticated users
export const achievements = sqliteTable('achievements', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	badgeKey: text('badge_key').notNull(),
	awardedAt: integer('awarded_at', { mode: 'number' }).notNull().default(nowMs()),
	contextJson: text('context_json')
});

// Runtime-editable app settings (admin-managed key/value).
// Keys: 'email.driver', 'email.smtp', 'email.graph', 'email.from', 'sso.roleMap'
export const appSettings = sqliteTable('app_settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs()),
	updatedBy: text('updated_by').references(() => user.id)
});

// Translations table
export const translations = sqliteTable('translations', {
	id: text('id').primaryKey(),
	locale: text('locale', { enum: ['en', 'de'] }).notNull(),
	key: text('key').notNull(),
	value: text('value').notNull(),
	createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
	updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs())
});
