import { sqliteTable, integer } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
	id: integer('id').primaryKey(),
	email: text('email').notNull().unique(), 
	passwordHash: text('email'), 
	role: text('role').notNull().default(student), 
	createdAt: integer('created_at', { mode: 'number' })
	    .notNull()
	    .default(nowMs()),
	updatedAt: integer('updated_at', { mode: 'number' })
	    .notNull()
	    .default(nowMs()),
});

// Exercises
// Keep JSON fields as text to stay SQLite-portable.
// Parse/validate at the app layer with Zod/JSON-Schema.
export const exercise = sqliteTable('exercises', {
	id: text('id').primaryKey(), 
	type: text('id').notNull(), 
	// Metadata: difficulty, tags, ageBand, estimatedTime, etc.
	metaJson: text('meta_json').notNull(), // JSON string
	// Localized content: { title: {de,en}, description: {de,en}, hints: [{de,en}, ...] }
	contentJson: text('content_json').notNull(), // JSON string
	// toolboxJson: text('toolbox_json').notNull(), // JSON string (string[])
	starterXml: text('starter_xml'), // can be null/empty
	// Grader config: tests, normalize options, etc.
	graderJson: text('grader_json').notNull(), // JSON string
	// Versioning/state (optional): 'draft' | 'published'
	status: text('status').notNull().default('draft'),
	// Audit
	createdBy: text('created_by'), // users.id or null
	updatedBy: text('updated_by'),
	createdAt: integer('created_at', { mode: 'number' })
	    .notNull()
	    .default(nowMs()),
	updatedAt: integer('updated_at', { mode: 'number' })
	    .notNull()
	    .default(nowMs()),
	archivedAt: integer('archived_at', { mode: 'number' }),
});

// For version history of exercises
export const exerciseVersions = sqliteTable('exercise_versions', {
	  id: text('id').primaryKey(), // ulid
	  exerciseId: text('exercise_id')
	    .notNull()
	    .references(() => exercises.id, { onDelete: 'cascade' }),
	  snapshotJson: text('snapshot_json').notNull(), // entire exercise row as JSON
	  message: text('message'), // commit message / change note
	  createdBy: text('created_by'),
	  createdAt: integer('created_at', { mode: 'number' })
	    .notNull()
	    .default(nowMs()),
});

export const quizzes = sqliteTable('quizzes', {
	id: text('id').primaryKey(), 
	titleJson: text('title_json').primaryKey(), 
	exercisesJson: text('exercises_json').primaryKey(), 
	randomize: integer('randomize', { mode: 'boolean' }).primaryKey().default(false), 
	prerequisitesJson: text('prerequisites_json'),
	createdAt: integer('created_at', { mode: 'number' })
	    .notNull()
	    .default(nowMs()),
	  updatedAt: integer('updated_at', { mode: 'number' })
	    .notNull()
	    .default(nowMs()),
	
	
})


export const attempts = sqliteTable('attempts', {
  id: text('id').primaryKey(), // ulid
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercises.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
  // For guest mode, you can store a client-side id (localStorage) if desired
  clientId: text('client_id'),
  // Result payload: { passed, score, tests: [...] }
  resultJson: text('result_json').notNull(),
  locale: text('locale').notNull().default('de'),
  startedAt: integer('started_at', { mode: 'number' }).notNull(),
  endedAt: integer('ended_at', { mode: 'number' }),
  // Simple analytics fields (optional duplicates for quick queries)
  score: integer('score'), // 0..100 (store percent * 100 or 0..1 scaled later)
  passed: integer('passed', { mode: 'boolean' }),
  createdAt: integer('created_at', { mode: 'number' })
    .notNull()
    .default(nowMs()),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(), // ulid
  ts: integer('ts', { mode: 'number' }).notNull().default(nowMs()),
  actorUserId: text('actor_user_id').references(() => users.id),
  action: text('action').notNull(), // e.g., 'exercise.create', 'attempt.grade'
  detailsJson: text('details_json'), // JSON detail
});
