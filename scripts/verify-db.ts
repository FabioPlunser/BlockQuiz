import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { canonicalizeExercise, validateExercise } from '../src/lib/types/exercise';

const dbPath = join(mkdtempSync(join(tmpdir(), 'blockquiz-db-verify-')), 'verify.sqlite');
const env = {
	...process.env,
	DATABASE_URL: `file:${dbPath}`
};

async function runStep(command: string[], label: string) {
	const proc = Bun.spawn(command, {
		env,
		stdout: 'pipe',
		stderr: 'pipe'
	});

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited
	]);

	if (exitCode !== 0) {
		throw new Error(`${label} failed with exit code ${exitCode}\n${stdout}\n${stderr}`);
	}
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) {
		throw new Error(message);
	}
}

function tableColumns(db: Database, tableName: string) {
	return new Set(
		db
			.query<{ name: string }, [string]>('SELECT name FROM pragma_table_info(?)')
			.all(tableName)
			.map((column) => column.name)
	);
}

function assertTableColumns(db: Database, tableName: string, expectedColumns: string[]) {
	const columns = tableColumns(db, tableName);
	for (const column of expectedColumns) {
		assert(columns.has(column), `Missing column ${tableName}.${column}`);
	}
}

await runStep(['bun', '--bun', 'run', 'db:push'], 'Initial schema setup');
await runStep(['bun', '--bun', 'run', 'db:push'], 'Idempotent schema setup');
await runStep(['bun', '--bun', 'run', 'db:seed'], 'Initial seed');
await runStep(['bun', '--bun', 'run', 'db:seed'], 'Idempotent seed');

assert(existsSync(dbPath), 'Verification database was not created');

const db = new Database(dbPath);

const tableRows = db
	.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'")
	.all();
const tables = new Set(tableRows.map((table) => table.name));

for (const table of [
	'user',
	'session',
	'account',
	'courses',
	'exercises',
	'course_exercises',
	'course_users',
	'exercise_versions',
	'attempts',
	'audit_logs',
	'translations',
	'achievements'
]) {
	assert(tables.has(table), `Missing table ${table}`);
}

assertTableColumns(db, 'exercises', [
	'id',
	'course_id',
	'type',
	'content',
	'config',
	'validation_json',
	'published',
	'created_by',
	'updated_at'
]);

assertTableColumns(db, 'attempts', [
	'id',
	'exercise_id',
	'user_id',
	'client_id',
	'actor_type',
	'workspace_xml',
	'generated_code',
	'result_json',
	'locale',
	'started_at',
	'ended_at',
	'score',
	'passed',
	'hint_events_json',
	'analytics_json',
	'created_at'
]);

const courseCount = db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM courses').get();
const exerciseCount = db
	.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM exercises')
	.get();
const firstExercise = db.query<{ id: string }, []>('SELECT id FROM exercises LIMIT 1').get();

assert(courseCount?.count === 2, `Expected 2 seeded courses, got ${courseCount?.count ?? 0}`);
assert(
	exerciseCount?.count === 10,
	`Expected 10 seeded exercises, got ${exerciseCount?.count ?? 0}`
);
assert(firstExercise, 'Expected at least one seeded exercise for attempt constraint verification');

db.query(
	`INSERT INTO attempts (
		id,
		exercise_id,
		client_id,
		actor_type,
		workspace_xml,
		generated_code,
		result_json,
		started_at
	) VALUES (?, ?, ?, 'guest', '', '', '{}', ?)`
).run('valid-guest-attempt', firstExercise.id, 'guest-client', Date.now());

let rejectedInvalidActor = false;
try {
	db.query(
		`INSERT INTO attempts (
			id,
			exercise_id,
			actor_type,
			workspace_xml,
			generated_code,
			result_json,
			started_at
		) VALUES (?, ?, 'user', '', '', '{}', ?)`
	).run('invalid-user-attempt', firstExercise.id, Date.now());
} catch {
	rejectedInvalidActor = true;
}

assert(rejectedInvalidActor, 'Attempt actor CHECK constraint did not reject an invalid row');

type SeededExerciseRow = {
	id: string;
	type: string;
	content: string;
	config: string;
	published: number;
	archived_at: number | null;
};

const publishedExercises = db
	.query<SeededExerciseRow, []>(
		`SELECT id, type, content, config, published, archived_at
		 FROM exercises
		 WHERE published = 1 AND archived_at IS NULL`
	)
	.all();

const validationFailures: { id: string; issues: string }[] = [];

for (const row of publishedExercises) {
	const exercise = canonicalizeExercise({
		id: row.id,
		type: row.type as 'io' | 'turtle' | 'robot',
		content: JSON.parse(row.content),
		config: JSON.parse(row.config),
		published: true
	});

	const result = validateExercise(exercise);
	if (!result.valid) {
		validationFailures.push({
			id: row.id,
			issues: result.issues.map((issue) => `${issue.field}: ${issue.message}`).join('; ')
		});
	}
}

if (validationFailures.length > 0) {
	const summary = validationFailures.map((f) => `  - ${f.id}: ${f.issues}`).join('\n');
	throw new Error(
		`${validationFailures.length} published seed exercise(s) failed publish validation:\n${summary}`
	);
}

assert(
	publishedExercises.length > 0,
	'Expected at least one published seeded exercise to validate'
);

db.close();

console.log(
	`Database verification passed for ${dbPath} (validated ${publishedExercises.length} published exercises)`
);
