# Block-based Learning Platform (8–12) — MVP

Web-based, block-programming learning platform for kids (8–12) with auto-grading. Focused, Brilliant-style exercises with minimal toolboxes, sandboxed execution, and DE/EN localization. MVP ships two exercise types (I/O and Turtle/Canvas), client-side sandbox + graders, and a lightweight authoring flow.

## Why

- Aligns with "Digitale Grundbildung" (AT) for early programming.
- Existing tools are too open/complex for short, goal-oriented tasks.
- Privacy-first, on-prem friendly (Docker, SQLite), easy classroom deployment.

## Core Features (MVP)

- Exercises: 10 curated tasks (loops, conditions, variables, simple functions)
- Two exercise types: I/O (stdin/stdout) and Turtle/Canvas
- Client-side sandbox (iframe), seeded RNG, loop-trap, timeouts
- Autograding: visible/hidden tests, normalization, Turtle end-state/command-log
- Authoring: JSON/DB schema, toolbox per exercise, hints, translations (DE/EN)
- i18n: Paraglide for UI; content localized per exercise
- Deployment: Docker, privacy-by-default

## Tech Stack

- SvelteKit (Svelte 5, Tailwind, typography)
- Bun (runtime and package manager)
- Blockly
- SQLite + Drizzle ORM (migrations)
- Paraglide i18n (UI strings), exercise content DE/EN in JSON/DB
- Playwright (E2E), Vitest (unit)
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

# Run database migrations
DATABASE_URL=file:./data/dev.db bun run db:push

# Start the development server (uses Bun runtime for bun:sqlite)
bun --bun run dev
```

The dev server will be available at `http://localhost:5173`.

> **Important:** Use `bun --bun run dev` instead of `bun run dev` to ensure the Bun runtime is used for `bun:sqlite` database access.

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
- Source code changes are reflected immediately
- Database persisted in `./data/dev.db`
- Node modules cached in a named volume

### Production Deployment

Build and run the production container:

```bash
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
- Automatic restart on failure
- Health checks enabled
- Database persisted in `./data/prod.db`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | SQLite database path (format: `file:./data/[name].db`) | Required |
| `NODE_ENV` | Environment (`development` or `production`) | `development` |
| `PORT` | Server port (production only) | `3000` |
| `AUTH_SECRET` | Session secret for authentication | Optional |

### Database Management

The SQLite database is stored in the `./data/` directory and persisted via Docker volumes.

```bash
# Run migrations (development)
docker compose -f docker-compose.dev.yml exec app bun run db:push

# Run migrations (production - before first start)
DATABASE_URL=file:./data/prod.db bun run db:push

# Open Drizzle Studio (local only)
DATABASE_URL=file:./data/dev.db bun run db:studio
```

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
- Run migrations if the database is new
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
- `drizzle/` — database migrations
- `data/` — SQLite database files
- `static/` — static assets

## Scripts

| Command | Description |
|---------|-------------|
| `bun --bun run dev` | Start development server (with Bun runtime) |
| `bun run build` | Build for production |
| `bun run preview` | Preview production build |
| `bun run check` | Type-check the codebase |
| `bun run lint` | Lint and format check |
| `bun run format` | Format code with Prettier |
| `bun run test` | Run unit tests |
| `bun run db:push` | Push schema changes to database |
| `bun run db:generate` | Generate migrations |
| `bun run db:migrate` | Run migrations |
| `bun run db:studio` | Open Drizzle Studio |

## Security & Privacy

- Sandbox iframe with strict CSP; no network from learner code
- Privacy-by-default mode (no PII, local analytics only, no external calls)
- Logs short retention, anonymized if enabled
- Self-hosted deployment for full data control

## License and Contributions

- License: TBD
- Contributions: PRs welcome for bug fixes and content; keep scope aligned with MVP

## Status

- Initial scaffolding underway. See PROJECT_STATUS.md for detailed progress.
