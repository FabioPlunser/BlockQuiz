import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { eq } from 'drizzle-orm';
import { attempts } from '../src/lib/server/db/schema';

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const sqlitePath = process.env.DATABASE_URL.replace(/^file:/, '');
const client = new Database(sqlitePath);
const db = drizzle(client, { schema: { attempts } });

const rows = await db
	.select({ id: attempts.id, analyticsJson: attempts.analyticsJson })
	.from(attempts);

let scanned = 0;
let updated = 0;

for (const row of rows) {
	scanned++;
	if (!row.analyticsJson) continue;

	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(row.analyticsJson);
	} catch {
		continue;
	}

	if (!parsed || typeof parsed !== 'object' || !('importedFromGuest' in parsed)) {
		continue;
	}

	delete parsed.importedFromGuest;
	await db
		.update(attempts)
		.set({ analyticsJson: JSON.stringify(parsed) })
		.where(eq(attempts.id, row.id));
	updated++;
}

console.log(`Scanned ${scanned} attempts; stripped importedFromGuest from ${updated}.`);
client.close();
