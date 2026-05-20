import { sqliteTable, integer, text, check, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
	role: text('role', { enum: ['student', 'teacher', 'admin'] })
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
	demo: integer('demo', { mode: 'boolean' }).notNull().default(false),
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

// Exercises table — membership in courses is M:N via `courseExercises`.
// Exercises themselves have no `courseId` column.
export const exercises = sqliteTable('exercises', {
	id: text('id').primaryKey(),
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
export const auditLogs = sqliteTable(
	'audit_logs',
	{
		id: text('id').primaryKey(),
		ts: integer('ts', { mode: 'number' }).notNull().default(nowMs()),
		actorUserId: text('actor_user_id').references(() => user.id),
		category: text('category', { enum: ['system', 'admin', 'user'] })
			.notNull()
			.default('user'),
		action: text('action').notNull(),
		detailsJson: text('details_json')
	},
	(table) => [
		index('audit_logs_actor_ts_idx').on(table.actorUserId, table.ts),
		index('audit_logs_category_ts_idx').on(table.category, table.ts),
		index('audit_logs_action_ts_idx').on(table.action, table.ts),
		index('audit_logs_ts_idx').on(table.ts)
	]
);

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

// Class/cohort entity. Either "IdP-owned" (ssoProviderId + externalKey both set;
// membership reconciled from group claims on every login) or "manual" (both null;
// membership maintained by admin). On ssoProvider delete, fall back to manual so
// historical enrolment is preserved.
export const classes = sqliteTable(
	'classes',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description'),
		ssoProviderId: text('sso_provider_id').references(() => ssoProvider.id, {
			onDelete: 'set null'
		}),
		externalKey: text('external_key'),
		archivedAt: integer('archived_at', { mode: 'number' }),
		createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
		updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs()),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' })
	},
	(t) => [
		index('classes_provider_external_idx').on(t.ssoProviderId, t.externalKey),
		index('classes_name_idx').on(t.name)
	]
);

// M:N user ↔ class. `source` records why the row exists: 'sso' rows are managed
// by the provisionUser hook (added/removed from claim deltas); 'manual' rows are
// admin-managed and MUST NOT be touched by the sync algorithm. A user can have
// both for the same class.
export const classUsers = sqliteTable(
	'class_users',
	{
		id: text('id').primaryKey(),
		classId: text('class_id')
			.notNull()
			.references(() => classes.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		source: text('source', { enum: ['sso', 'manual'] }).notNull().default('manual'),
		addedBy: text('added_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
		updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs())
	},
	(t) => [
		uniqueIndex('class_users_class_user_source_uq').on(t.classId, t.userId, t.source),
		index('class_users_user_idx').on(t.userId)
	]
);

// Course assignment by class. Effective enrolment for a course = direct
// courseUsers ∪ members of classes linked here (deduped).
export const courseClasses = sqliteTable(
	'course_classes',
	{
		id: text('id').primaryKey(),
		courseId: text('course_id')
			.notNull()
			.references(() => courses.id, { onDelete: 'cascade' }),
		classId: text('class_id')
			.notNull()
			.references(() => classes.id, { onDelete: 'cascade' }),
		addedBy: text('added_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
		updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs())
	},
	(t) => [
		uniqueIndex('course_classes_course_class_uq').on(t.courseId, t.classId),
		index('course_classes_class_idx').on(t.classId)
	]
);

// Discovery surface: every distinct group-claim value seen on login, per provider.
// Lets admins audit which IdP groups exist before promoting any into class rows.
// Appended (upserted) outside the sync transaction so login is never blocked by
// discovery bookkeeping.
export const idpGroupSeen = sqliteTable(
	'idp_group_seen',
	{
		id: text('id').primaryKey(),
		ssoProviderId: text('sso_provider_id')
			.notNull()
			.references(() => ssoProvider.id, { onDelete: 'cascade' }),
		externalKey: text('external_key').notNull(),
		firstSeenAt: integer('first_seen_at', { mode: 'number' }).notNull().default(nowMs()),
		lastSeenAt: integer('last_seen_at', { mode: 'number' }).notNull().default(nowMs()),
		occurrenceCount: integer('occurrence_count', { mode: 'number' }).notNull().default(1),
		sampleUserIds: text('sample_user_ids', { mode: 'json' })
			.$type<string[]>()
			.notNull()
			.default(sql`'[]'`)
	},
	(t) => [uniqueIndex('idp_group_seen_provider_key_uq').on(t.ssoProviderId, t.externalKey)]
);
