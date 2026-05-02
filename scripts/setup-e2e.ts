import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databaseUrl = process.env.DATABASE_URL ?? 'file:./data/e2e.sqlite';
process.env.DATABASE_URL = databaseUrl;
process.env.SEED_TEACHER_PASSWORD ??= 'BlockQuiz123!';

const sqlitePath = databaseUrl.replace(/^file:/, '');
const absoluteSqlitePath = resolve(process.cwd(), sqlitePath);

mkdirSync(dirname(absoluteSqlitePath), { recursive: true });

if (existsSync(absoluteSqlitePath)) {
	rmSync(absoluteSqlitePath);
}

await import('./db-push');
await import('./seed');

console.log(`E2E database prepared at ${absoluteSqlitePath}`);
