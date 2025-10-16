# Block-based Learning Platform (8–12) — MVP

Web-based, block-programming learning platform for kids (8–12) with auto-grading. Focused, Brilliant-style exercises with minimal toolboxes, sandboxed execution, and DE/EN localization. MVP ships two exercise types (I/O and Turtle/Canvas), client-side sandbox + graders, and a lightweight authoring flow.

## Why
- Aligns with “Digitale Grundbildung” (AT) for early programming.
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
- Blockly
- SQLite + Drizzle ORM (migrations)
- Paraglide i18n (UI strings), exercise content DE/EN in JSON/DB
- Playwright (E2E), Vitest (unit)
- Docker Compose

## Repo Structure (proposed)
- src/routes/exercise/[id]/ — learner UI
- src/routes/admin/ — CMS views
- src/lib/blockly/ — workspace setup, generators
- src/lib/sandbox/ — iframe, API, loop-trap
- src/lib/grader/ — io, turtle graders
- src/lib/i18n/ — Paraglide config
- src/lib/db/ — Drizzle schema, migrations, seeds
- exercises/ — static JSON samples (if used)
- docker/ — compose, nginx/CSP, scripts

## Roadmap (High-level)
1) Core loop: load exercise → build blocks → run in sandbox → grade
2) Turtle engine + grader
3) Minimal CMS CRUD + linter + translation editor
4) Content: 10 exercises DE/EN, quiz assembly
5) Tests (unit/E2E), accessibility, performance polish
6) Pilot (4–6 kids), analysis, iteration
7) Thesis figures, screenshots, final polish

## Weekend Starter Checklist
- [ ] Repo hygiene: ESLint, Prettier, GitHub Actions (lint/build), .env
- [ ] ENV flags: PRIVACY_MODE, AUTH, ANALYTICS, LOG_LEVEL
- [ ] Drizzle + SQLite: tables (exercises, quizzes, attempts, audit_logs)
- [ ] Exercise/Quiz TypeScript types + JSON-Schema
- [ ] Paraglide setup (de/en); locale store + fallback
- [ ] Route /exercise/[id] loads demo exercise and displays metadata
- [ ] Sandbox skeleton: iframe, postMessage (run/result/error), 2s timeout
- [ ] Blockly minimal: workspace, per-exercise toolbox, starter XML, JS generation
- [ ] RUN button → sandbox; capture output/log
- [ ] I/O grader: normalization, tests, pass/fail UI; CHECK end-to-end on “Sum 1..N”

## Implementation Milestones
- [ ] Sandbox safety: loop-trap, seeded RNG, restricted API, CSP
- [ ] I/O grader robust: visible/hidden tests, diffs, deterministic results
- [ ] Turtle engine: move/turn/pen, command log, end-state grading, overlay
- [ ] CMS minimal:
  - [ ] CRUD for exercises/quizzes
  - [ ] Linter: required fields, DE/EN keys, hidden test present, toolbox/starter consistency
  - [ ] Side-by-side translation editor; “Machine translate” button (provider behind flag)
- [ ] Content: 10 exercises with hints and DE/EN
- [ ] i18n: Paraglide for UI; content fallback to default
- [ ] Analytics (local, pseudonymous) and export (CSV/JSON, no PII)
- [ ] Tests: unit (grader/normalization), E2E (solve I/O, Turtle, quiz), basic visual for Turtle
- [ ] Accessibility: keyboard nav, focus, ARIA; WCAG AA contrast
- [ ] Performance: lazy-load Blockly, TTI < 2s on reference device
- [ ] Docker Compose: persistent SQLite volume; WAL mode; backup scripts

## Non-Goals (MVP)
- Full class management/SSO
- Broad plugin marketplace (document API only)
- Complex simulators beyond Turtle/2D
- Cloud dependencies without privacy-safe fallback

## Scripts (suggested)
- dev: start SvelteKit
- db:migrate / db:seed
- test / test:e2e
- lint / format
- docker:up / docker:down / docker:backup

## Security & Privacy
- Sandbox iframe with strict CSP; no network from learner code
- Privacy-by-default mode (no PII, local analytics only, no external calls)
- Logs short retention, anonymized if enabled

## License and Contributions
- License: TBD
- Contributions: PRs welcome for bug fixes and content; keep scope aligned with MVP

## Status
- Initial scaffolding underway. See checklist above; update as you complete items.