# Database Setup And Verification

BlockQuiz uses SQLite through Bun's native `bun:sqlite` driver and Drizzle schema definitions.

## Canonical Thesis Setup Path

For this thesis build, the canonical setup path is:

```bash
bun install --frozen-lockfile
bun --bun run db:push
bun --bun run db:seed
```

`db:push` runs `scripts/db-push.ts`, a Bun-native schema initializer. It is used by Docker startup, smoke tests, and local verification because the app depends on `bun:sqlite`.

## Migrations

The `drizzle/` directory contains historical migration artifacts from development. Do not rely on `bun --bun run db:migrate` as a guaranteed production upgrade path for arbitrary old SQLite databases unless the migration chain is repaired and verified separately.

For final thesis evaluation, prefer a fresh SQLite database or a backed-up database initialized with the current `db:push` path.

## Verification

Run:

```bash
bun --bun run db:verify
```

This creates a temporary SQLite database, runs `db:push` twice, runs `db:seed` twice, verifies required tables and columns, and confirms the expected seed counts.
It also checks that the attempt actor constraint rejects invalid user/guest actor combinations.

## Production Notes

- Back up `./data/prod.db` before deploying a new version.
- Production requires `BETTER_AUTH_URL` and `AUTH_SECRET`.
- SQLite is appropriate for single-school or thesis-demo deployments. For larger concurrent deployments, PostgreSQL or a managed database would be future work.
