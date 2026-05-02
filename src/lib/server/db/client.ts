import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

// DATABASE_URL is a file: URL (e.g. file:data/dev.db); bun:sqlite wants just the path.
const dbUrl = env.DATABASE_URL;
const sqlitePath = dbUrl.replace(/^file:/, '');

const client = new Database(sqlitePath);
client.exec('PRAGMA foreign_keys = ON');

export const db = drizzle(client, { schema });
