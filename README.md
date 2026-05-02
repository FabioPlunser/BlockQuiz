# Block-based Learning Platform (8–12) — MVP

Web-based, block-programming learning platform for kids (8-12) with auto-grading. Focused exercises use minimal toolboxes, sandboxed execution, DE/EN localization, and a teacher-facing CMS. The MVP supports I/O, turtle, and robot exercises.

## Why

- Aligns with "Digitale Grundbildung" (AT) for early programming.
- Existing tools are too open/complex for short, goal-oriented tasks.
- Privacy-first, on-prem friendly (Docker, SQLite), easy classroom deployment.

## Core Features (MVP)

- Exercises: 10 curated tasks (loops, conditions, variables, simple functions)
- Three exercise types: I/O (stdin/stdout), Turtle/Canvas, and grid Robot
- Client-side sandbox (iframe), seeded RNG, loop-trap, timeouts
- Autograding: visible/hidden tests, normalization, end-state/path/command checks
- Authoring: CMS-backed courses and exercises, toolbox per exercise, hints, translations (DE/EN)
- i18n: built-in DE/EN dictionaries; content localized per exercise
- Deployment: Docker, privacy-by-default

## Tech Stack

- SvelteKit (Svelte 5, Tailwind, typography)
- Bun (runtime and package manager)
- Blockly
- SQLite + Drizzle ORM schema
- Custom DE/EN i18n, exercise content DE/EN in JSON/DB
- Vitest unit tests, Playwright browser tests, and production smoke checks
- Docker Compose

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+) for local development
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) for containerized deployment

### Local Development (without Docker)

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env as needed (DATABASE_URL is required)

# Initialize/update the SQLite schema
DATABASE_URL=file:./data/dev.db bun --bun run db:push

# Start the development server
bun --bun run dev
```

The dev server will be available at `http://localhost:5173`.

Use `bun --bun run ...` for app scripts so tooling runs in Bun mode and `bun:sqlite` works consistently.

### Local Verification

```bash
bun --bun run check
bun --bun run test
bun --bun run test:e2e
bun --bun run build
bun --bun run smoke
bun --bun run docker:smoke
```

## Docker Deployment

### Development with Docker (Hot Reloading)

Use Docker Compose for development with hot reloading enabled:

```bash
# Start the development container
docker compose -f docker-compose.dev.yml up

# Or run in detached mode
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Stop the container
docker compose -f docker-compose.dev.yml down
```

The development server will be available at `http://localhost:5173`.

**Features:**

- Hot reloading via volume mounts
- Schema is initialized automatically before the dev server starts
- Source code changes are reflected immediately
- Database persisted in `./data/dev.db`
- Node modules cached in a named volume

### Production Deployment

Build and run the production container:

```bash
# Required once per shell/session for production auth
export BETTER_AUTH_URL=http://localhost:3000
export AUTH_SECRET=$(openssl rand -base64 32)

# Build and start the production container
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop the container
docker compose -f docker-compose.prod.yml down

# Rebuild after code changes
docker compose -f docker-compose.prod.yml up -d --build
```

The production server will be available at `http://localhost:3000`.

**Features:**

- Optimized multi-stage build
- Schema is initialized automatically before the server starts
- Automatic restart on failure
- Health checks enabled
- Database persisted in `./data/prod.db`

### Environment Variables

| Variable          | Description                                            | Default                      |
| ----------------- | ------------------------------------------------------ | ---------------------------- |
| `DATABASE_URL`    | SQLite database path (format: `file:./data/[name].db`) | Required                     |
| `NODE_ENV`        | Environment (`development` or `production`)            | `development`                |
| `PORT`            | Server port (production only)                          | `3000`                       |
| `AUTH_SECRET`     | Session secret for authentication                      | Required in production       |
| `BETTER_AUTH_URL` | Public app URL used by authentication callbacks        | Required in production       |
| `ORIGIN`          | Public origin used by the Bun adapter                  | `BETTER_AUTH_URL` in Compose |
| `APP_PORT`        | Host port for production Docker Compose                | `3000`                       |
| `DATA_DIR`        | Host data directory for production Docker Compose      | `./data`                     |
| `LOGS_DIR`        | Host log directory for production Docker Compose       | `./logs`                     |

### Database Management

The SQLite database is stored in the `./data/` directory and persisted via Docker volumes.
For this thesis build, `db:push` is the canonical clean-schema initialization path used by
Docker startup and smoke tests. The Drizzle migration files are historical development artifacts;
do not rely on `db:migrate` as a production upgrade path for arbitrary older databases.

```bash
# Initialize/update schema (development)
docker compose -f docker-compose.dev.yml exec app bun --bun run db:push

# Initialize/update schema manually (production, normally handled by compose startup)
DATABASE_URL=file:./data/prod.db bun --bun run db:push

# Open Drizzle Studio (local only)
DATABASE_URL=file:./data/dev.db bun --bun run db:studio
```

## Import/Export JSON

CMS course and exercise imports use documented JSON transfer envelopes. See `docs/import-export.md` for the supported shapes and examples.

Database setup and verification are documented in `docs/database.md`.

Public and authenticated route behavior is documented in `docs/access-policy.md`.

Imported courses and exercises are saved as drafts, so teachers can review them before publishing.

### Database Backup

```bash
# Create a backup
cp ./data/prod.db ./data/prod.db.backup

# Restore from backup
cp ./data/prod.db.backup ./data/prod.db
```

### Troubleshooting

**Container won't start:**

- Check logs: `docker compose -f docker-compose.[dev|prod].yml logs`
- Ensure `./data/` directory exists and is writable
- Verify environment variables are set correctly

**Database errors:**

- Ensure `DATABASE_URL` points to a valid path
- Run `bun --bun run db:push` if the database is new
- Check file permissions on `./data/` directory

**Hot reloading not working (dev):**

- Ensure you're using `docker-compose.dev.yml`
- Check that volume mounts are correct
- Try restarting the container

**Port conflicts:**

- Change the port mapping in the compose file (e.g., `"8080:3000"`)

## Repo Structure

- `src/routes/` — SvelteKit routes (learner UI, CMS)
- `src/lib/blockly/` — workspace setup, generators
- `src/lib/canvas/` — Turtle and Robot engines
- `src/lib/graders/` — I/O and Turtle graders
- `src/lib/components/` — Svelte components
- `src/lib/server/db/` — Drizzle schema and client
- `drizzle/` — historical database migration artifacts
- `data/` — SQLite database files
- `static/` — static assets

## Scripts

| Command                      | Description                                   |
| ---------------------------- | --------------------------------------------- |
| `bun --bun run dev`          | Start development server (with Bun runtime)   |
| `bun --bun run build`        | Build for production                          |
| `bun --bun run preview`      | Preview production build                      |
| `bun --bun run check`        | Type-check the codebase                       |
| `bun --bun run lint`         | Lint and format check                         |
| `bun --bun run format`       | Format code with Prettier                     |
| `bun --bun run test`         | Run unit tests                                |
| `bun --bun run test:e2e`     | Run focused Playwright browser tests          |
| `bun --bun run smoke`        | Smoke-test the production build               |
| `bun --bun run docker:smoke` | Build and smoke-test production Docker image  |
| `bun --bun run db:push`      | Initialize/update SQLite schema               |
| `bun --bun run db:generate`  | Generate Drizzle migrations                   |
| `bun --bun run db:migrate`   | Run historical Drizzle migrations             |
| `bun --bun run db:studio`    | Open Drizzle Studio                           |
| `bun --bun run db:verify`    | Verify temp schema setup and seed idempotency |

## Security & Privacy

- Learner execution uses sandboxing layers, command/loop/time limits, and server-side authoritative grading
- Guest mode can run without an account; authenticated mode stores account and attempt data locally in SQLite
- Teacher/research exports derive from stored attempts; research export uses pseudonymous identifiers
- Self-hosted deployment for full data control

## Known Limitations

- The current SQLite setup path is `db:push`; arbitrary old-database migrations are not guaranteed.
- Server-side authoritative grading still runs in process and is not a separate container sandbox.
- Browser E2E coverage is focused on critical flows; complex CMS/export workflows are still not exhaustive.

## License and Contributions

- License: TBD
- Contributions: PRs welcome for bug fixes and content; keep scope aligned with MVP

## Status

- Active MVP implementation with CMS, learner player, guest/demo flow, sandbox execution, graders, seed content, and Docker setup. Use `plan.md` for the remaining delivery checklist.
