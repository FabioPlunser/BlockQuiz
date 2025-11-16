import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Helper for timestamps
const nowMs = () => sql`(unixepoch() * 1000)`;

// Users table
export const users = sqliteTable('users', {
	id: text('id').primaryKey(), // use ulid()
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash'),
	role: text('role', { enum: ['student', 'teacher', 'author', 'admin'] })
		.notNull()
		.default('student'),
	createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
	updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs())
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at', { mode: 'number' }).notNull()
});

// Exercises table
export const exercises = sqliteTable('exercises', {
	id: text('id').primaryKey(),
	type: text('type', { enum: ['io', 'turtle'] }).notNull(),
	metaJson: text('meta_json').notNull(),
	contentJson: text('content_json').notNull(),
	toolboxJson: text('toolbox_json').notNull(),
	starterXml: text('starter_xml'),
	graderJson: text('grader_json').notNull(),
	status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
	createdBy: text('created_by'),
	updatedBy: text('updated_by'),
	createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
	updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs()),
	archivedAt: integer('archived_at', { mode: 'number' })
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

// Quizzes table
export const quizzes = sqliteTable('quizzes', {
	id: text('id').primaryKey(),
	titleJson: text('title_json').notNull(),
	exercisesJson: text('exercises_json').notNull(),
	randomize: integer('randomize', { mode: 'boolean' }).notNull().default(false),
	prerequisitesJson: text('prerequisites_json'),
	createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs()),
	updatedAt: integer('updated_at', { mode: 'number' }).notNull().default(nowMs())
});

// Attempts table
export const attempts = sqliteTable('attempts', {
	id: text('id').primaryKey(),
	exerciseId: text('exercise_id')
		.notNull()
		.references(() => exercises.id, { onDelete: 'cascade' }),
	userId: text('user_id').references(() => users.id),
	clientId: text('client_id'),
	resultJson: text('result_json').notNull(),
	locale: text('locale', { enum: ['de', 'en'] }).notNull().default('de'),
	startedAt: integer('started_at', { mode: 'number' }).notNull(),
	endedAt: integer('ended_at', { mode: 'number' }),
	score: integer('score'),
	passed: integer('passed', { mode: 'boolean' }),
	createdAt: integer('created_at', { mode: 'number' }).notNull().default(nowMs())
});

// Audit logs table
export const auditLogs = sqliteTable('audit_logs', {
	id: text('id').primaryKey(),
	ts: integer('ts', { mode: 'number' }).notNull().default(nowMs()),
	actorUserId: text('actor_user_id').references(() => users.id),
	action: text('action').notNull(),
	detailsJson: text('details_json')
});