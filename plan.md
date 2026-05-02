# BlockQuiz Final Gap Implementation Plan

Always use Bun. Run commands from `code/` with `bun --bun run ...` unless a command is not a package script.

## Purpose

This file is the current implementation plan for closing every missing, weak, or overclaimed feature before final Bachelor thesis submission.

It replaces older split plans and stale notes. Older notes that say `io`, guest mode, import/export, preview, authoritative grading, research export, or green checks are missing are outdated unless a fresh regression proves otherwise.

## Current Implemented Baseline

The following features are implemented and should be preserved:

- Teacher CMS for courses and exercises.
- Learner course player for authenticated users.
- Public guest/demo flow with local progress, export/import, and explicit account import.
- Three exercise types: `io`, `turtle`, and `robot`.
- Hidden tests are stripped from learner-visible payloads.
- Authenticated submissions are regraded authoritatively server-side and client score/pass/result are not trusted.
- Authenticated course play restores the latest workspace snapshot and previous stored grading result.
- Course and exercise JSON import/export exist and imports default to unpublished content.
- Attempts are the analytics source of truth.
- Teacher analytics basics, CSV/JSON export, and pseudonymized research export exist.
- Exercise/course publish validation exists and is enforced server-side.
- Published course validation rejects selected draft, archived, missing, or invalid exercises.
- IO seed exercises expose input/prompt and variable blocks and are intended to be solvable from Blockly.
- Runtime SQLite foreign keys and fresh-schema attempt actor constraints are enabled.
- Inactive users are blocked in auth/session guards.
- Public route policy is documented and tested; guest play starts at `/demo`.
- Public self-registration is disabled; accounts are admin-managed or guest mode is used.
- `/settings` is a localized account/help hub.
- Structured audit logs are written for admin user/course/exercise mutations and shown with app logs.
- Production requires `BETTER_AUTH_URL` and `AUTH_SECRET`.
- `db:verify` verifies fresh schema setup, seed idempotency, seed counts, and attempt actor constraints.
- CI exists for lint/check/test/build/smoke, focused Playwright E2E, and Docker Compose config validation.
- Local gates currently expected to pass: `lint`, `check`, `test`, `test:e2e`, `build`, `smoke`, `docker:smoke`.

Known non-fatal build warnings:

- Better Auth unused external import warnings.
- `bun:sqlite` unresolved external warnings from Bun adapter output.

## Final Scope Principles

- Keep scope honest. Do not claim features that are not implemented or tested.
- Prefer finishing current MVP promises over adding speculative new features.
- Teacher authoring must not require hand-editing JSON.
- Learner UI must be child-friendly for ages 8-12.
- Attempts remain the only reporting source of truth.
- Imported content remains unpublished by default.
- Use documentation for intentional limitations only after deciding not to implement the stronger behavior.

## Phase 0: Report, README, And Scope Truth Alignment

Goal: make every written claim match the application.

Tasks:

- Finish or rewrite report sections that still contain TODO placeholders:
  - `report/sections/evaluation.tex`
  - `report/sections/implementation.tex`
  - `report/sections/conclusion.tex`
- Remove or soften unsupported claims in report/design docs:
  - “plugin administration” unless plugin administration is implemented.
  - “Strict CSP prevents inline scripts and external resource loading” unless CSP is tightened accordingly.
  - “participants who took part in the usability evaluation” unless a real usability evaluation happened.
  - “Chapter 6 presents evaluation with teachers” unless real evaluation content is added.
- Keep README aligned with actual verification:
  - no Playwright/E2E claim unless Playwright is added.
  - no full migration claim unless migration chain is fixed.
  - no “strict secure sandbox” claim unless stronger isolation/CSP is implemented.
- Add a short “Known limitations” section for intentionally scoped limitations:
  - in-process server grading isolation if `node:vm` remains.
  - historical Drizzle migration chain if not repaired.
  - browser E2E coverage remains focused rather than exhaustive.

Hotspots:

- `README.md`
- `docs/`
- `../report/sections/design.tex`
- `../report/sections/implementation.tex`
- `../report/sections/evaluation.tex`
- `../report/sections/conclusion.tex`
- `../report/sections/ack.tex`

Acceptance:

- No TODO placeholder remains in final report sections.
- No feature is claimed unless it is implemented or explicitly described as a limitation/future work.
- README and thesis do not contradict each other.

## Phase 1: Database Reproducibility And Migration Story

Goal: make clean setup and production DB behavior reproducible and honest.

Tasks:

- Decide and document the canonical DB path.
  - Current likely decision: `scripts/db-push.ts` is canonical for this thesis build and clean/update initialization.
  - Drizzle migrations are historical unless repaired.
- Add `docs/database.md` with:
  - clean setup path.
  - Docker startup path.
  - backup/restore advice for SQLite.
  - explanation of `db:push` versus `db:migrate`.
- Fix or quarantine inconsistent migration history:
  - `drizzle/0005_add_actor_user_email.sql` exists but is not in `_journal.json`.
  - current schema does not include `actor_user_email`.
  - older migrations create stale table shapes.
- Improve `scripts/db-push.ts` if existing DB upgrade support is required:
  - inspect `PRAGMA table_info`.
  - add missing columns safely with `ALTER TABLE`.
  - keep `PRAGMA foreign_keys = ON`.
  - optionally use `PRAGMA user_version`.
- Add schema verification script:
  - create temp SQLite DB.
  - run `db:push`.
  - verify required tables and columns.
  - run `db:push` again to verify idempotency.

Hotspots:

- `scripts/db-push.ts`
- `src/lib/server/db/schema.ts`
- `drizzle/*.sql`
- `drizzle/meta/_journal.json`
- `README.md`
- `docs/database.md`
- `.github/workflows/verify.yml`

Acceptance:

- Fresh DB initialization is tested.
- Existing DB update behavior is either implemented or clearly documented as unsupported.
- README does not imply unsupported arbitrary production migrations.

## Phase 2: Attempt Integrity And Guest/Auth Parity

Goal: make attempts trustworthy and guest/auth flows equivalent where promised.

Tasks:

- Enforce attempt actor invariants at domain or DB level:
  - `actorType = 'user'` requires `userId` and no `clientId`.
  - `actorType = 'guest'` requires `clientId` and no `userId`.
  - exactly one of `userId` or `clientId` must be present.
- Add tests for forged authenticated submissions:
  - forged `score` is ignored.
  - forged `passed` is ignored.
  - forged hidden-test payload is rejected.
  - visible-only payload is accepted.
  - authoritative server result is returned and stored.
- Clarify imported guest attempts:
  - current linked attempts are stored as user attempts with original guest ID in `analyticsJson.importedFromGuest`.
  - either keep and document this, or add first-class origin fields.
- Decide whether authenticated learners need export/review comparable to guest mode:
  - option A: add authenticated personal progress export.
  - option B: keep exports teacher/research/guest only and document this.
- Add previous-attempt review using stored `resultJson`:
  - show last authoritative grading after resume.
  - avoid regrading just to display old results.

Hotspots:

- `src/lib/remote/courses.remote.ts`
- `src/lib/types/attempt.ts`
- `src/lib/server/db/schema.ts`
- `src/lib/components/player/CoursePlayer.svelte`
- `src/routes/(app)/courses/+page.svelte`
- `src/routes/demo/+page.svelte`
- `src/lib/guest-progress/storage.ts`

Acceptance:

- Authenticated progress never uses client-only visible tests as final truth.
- Attempt actor invariants cannot be violated in normal code paths and are tested.
- Guest import/linking semantics are explicit and tested.

## Phase 3: Public Access And Route Matrix

Goal: make public/demo/auth behavior explicit and tested.

Tasks:

- Write the final access policy in docs:
  - `/login`: public.
  - `/privacy`: public.
  - `/demo`: public.
  - public published course play: public through `/demo` or a dedicated public route.
  - `/courses`: authenticated assigned courses.
  - `/cms`: teacher/author/admin.
  - `/users`: admin only.
  - `/logs`: admin only.
  - `/settings`: authenticated or removed.
- Decide whether shareable public course URLs are required.
  - If yes, add `/demo/[courseId]` or query-based auto-open.
  - If no, document that public play starts from `/demo`.
- Add route matrix tests for:
  - guest.
  - student.
  - author.
  - teacher.
  - admin.
  - inactive user.

Hotspots:

- `src/hooks.server.ts`
- `src/lib/utils/requireAuth.ts`
- `src/lib/components/Navigation.svelte`
- `src/routes/demo/+page.svelte`
- `src/routes/(app)/courses/+page.svelte`
- `src/routes/(app)/cms/+page.svelte`
- `src/routes/(app)/users/+page.svelte`
- `src/routes/(app)/logs/+page.svelte`

Acceptance:

- Every protected and public route has an intended policy.
- UI navigation and remote permission checks match.
- Inactive users cannot access protected routes or remotes.

## Phase 4: Publish Validation Completion

Goal: published content cannot be broken or confusing for learners.

Tasks:

- Replace superficial starter XML validation with real XML parsing where available.
- Validate starter XML block IDs:
  - block IDs must be registered/known.
  - starter blocks should be compatible with the selected toolbox.
- Decide strict course publish rule:
  - recommended: every selected exercise in a published course must be published and valid.
  - alternative: allow invalid/draft selected exercises but show they are excluded from learner course.
- Add validation tests for:
  - invalid XML.
  - unknown starter block.
  - starter block outside allowed toolbox.
  - published course with draft exercise.
  - published course with invalid exercise.

Hotspots:

- `src/lib/types/exercise.ts`
- `src/lib/types/exercise.spec.ts`
- `src/lib/courses/validation.ts`
- `src/lib/courses/validation.spec.ts`
- `src/lib/remote/exercises.remote.ts`
- `src/lib/remote/courses.remote.ts`
- `src/routes/(app)/cms/ExerciseEditor.svelte`
- `src/routes/(app)/cms/CourseEditor.svelte`

Acceptance:

- A published exercise has parseable starter XML and only valid blocks.
- A published course cannot silently contain learner-broken exercises.

## Phase 5: Robot Type Distinctiveness

Goal: robot must feel like grid navigation, not turtle with a different icon.

Tasks:

- Expand robot blocks:
  - move forward one cell.
  - turn left.
  - turn right.
  - collect.
  - optional condition helpers: wall ahead, item here, target reached.
- Add robot runtime helpers:
  - grid coordinate conversion.
  - wall collision behavior.
  - collectible state.
  - clear user-facing feedback when blocked or collected.
- Improve robot grading:
  - final target reached.
  - wall avoidance.
  - collectible count.
  - final direction/state.
- Improve robot authoring UI:
  - grid-first labels.
  - wall/target/collectible placement clarity.
  - start and direction preview.
- Improve robot seed content:
  - one navigation puzzle with walls.
  - one collectible puzzle.
  - one loop/condition puzzle if condition blocks are added.
- Add tests:
  - starts from `grid.start`.
  - direction comes from `grid.direction`.
  - wall behavior is deterministic.
  - collect only works on collectible cell.
  - authoritative grading matches client grading.

Hotspots:

- `src/lib/canvas/Robot.svelte.ts`
- `src/lib/graders/index.ts`
- `src/lib/player/executor.ts`
- `src/lib/server/authoritative-execution.ts`
- `src/lib/components/player/ExecutionArea.svelte`
- `src/lib/components/player/ExercisePlayer.svelte`
- `src/routes/(app)/cms/ExerciseEditor.svelte`
- `scripts/seed.ts`

Acceptance:

- Robot exercises are recognizably grid puzzles.
- Seeded robot content proves walls/targets/collectibles or equivalent grid-specific behavior.

## Phase 6: Sandbox And Security Hardening

Goal: make execution safety stronger or explicitly scoped.

Tasks:

- Decide server authoritative isolation strategy:
  - option A: keep `node:vm` and document as thesis/demo limitation.
  - option B: move grading into a killed subprocess worker.
  - option C: use container/process isolation; largest scope.
- If implementing subprocess isolation:
  - create a grading worker entrypoint.
  - pass exercise/code via JSON.
  - enforce timeout by killing process.
  - ensure worker has no DB/session access.
- Add adversarial sandbox tests:
  - blocked `fetch`.
  - blocked `XMLHttpRequest`.
  - blocked storage APIs.
  - malformed messages.
  - timeout.
  - loop limit.
  - command limit.
  - hidden-test confidentiality.
- Review iframe sandbox origin/handshake behavior.
- Tighten CSP only if it does not break Svelte/Blockly/sandbox messaging.
- Align docs/report with real CSP if `unsafe-inline` remains.

Hotspots:

- `static/sandbox.html`
- `src/lib/sandbox/runtime.ts`
- `src/lib/sandbox/SandboxExecutor.ts`
- `src/lib/server/authoritative-execution.ts`
- `src/hooks.server.ts`
- `src/lib/sandbox/sandbox.test.ts`
- `src/lib/server/authoritative-execution.spec.ts`

Acceptance:

- Security claims match implementation.
- Hostile-code behavior is covered by tests.
- If `node:vm` remains, it is documented as not a hard isolation boundary.

## Phase 7: Auth And Account Flow Decisions

Goal: make account behavior intentional and abuse-resistant.

Tasks:

- Decide public registration behavior:
  - keep enabled for thesis/demo.
  - or add `REGISTRATION_ENABLED` for production control.
- Password reset:
  - keep explicitly unavailable without pretending email reset exists.
  - or implement real email reset if mail infrastructure is added.
- User management safety:
  - avoid accidental inline role/status edits.
  - add save/cancel or confirmation for role/status changes.
- Account enumeration:
  - use generic registration/login/reset messages if privacy/security priority.
- Add tests:
  - inactive user blocked.
  - disabled registration rejects signups if added.
  - password reset unavailable behavior is generic and stable.

Hotspots:

- `src/lib/server/auth.ts`
- `src/lib/remote/auth.remote.ts`
- `src/lib/remote/users.remote.ts`
- `src/routes/(app)/users/+page.svelte`
- `src/lib/components/login/ForgotPassword.svelte`
- `src/routes/(auth)/login/+page.svelte`

Acceptance:

- Registration/reset/user-management behavior is clear in UI and docs.
- Admin changes are intentional, not accidental blur-side effects.

## Phase 8: Settings Page Completion Or Removal

Goal: no placeholder route remains.

Tasks:

- Choose one final direction:
  - implement useful settings.
  - or remove settings route/navigation and document as out of scope.
- Recommended minimal settings page:
  - current user email.
  - role/status.
  - language selector.
  - password reset unavailable notice.
  - logout action.
  - admin-only system status: app version/build mode, DB path redacted.
- Add i18n keys and route title.
- Add smoke or unit coverage for route access.

Hotspots:

- `src/routes/(app)/settings/+page.svelte`
- `src/lib/components/Navigation.svelte`
- `src/lib/i18n/en.json`
- `src/lib/i18n/de.json`

Acceptance:

- `/settings` is either useful or removed.
- No visible placeholder page remains.

## Phase 9: Analytics UI And Export Depth

Goal: analytics are useful without manually inspecting JSON.

Tasks:

- Expand `CourseAnalytics.svelte` filters:
  - date range.
  - exercise type.
  - locale.
  - pass/fail.
- Add summary cards:
  - median or average duration.
  - average hints used.
  - average block count.
  - average generated code length.
  - locale mix.
- Add per-exercise detail columns:
  - attempts.
  - pass rate.
  - average score.
  - average duration.
  - hint usage.
- Add server-side CSV helper tests:
  - deterministic column order.
  - CSV escaping.
  - null/empty fields.
- Verify research export never includes raw user IDs, emails, or attempt IDs.
- Decide how imported guest origin appears in research export.

Hotspots:

- `src/routes/(app)/cms/CourseAnalytics.svelte`
- `src/lib/remote/courses.remote.ts`
- `src/lib/analytics/research-export.ts`
- `src/lib/analytics/research-export.spec.ts`
- `src/lib/types/attempt.ts`

Acceptance:

- Teacher UI surfaces the metrics already collected.
- CSV/JSON/research exports are test-covered and privacy-safe.

## Phase 10: Audit Logs

Goal: admin logs should reflect meaningful system actions.

Tasks:

- Decide final log source:
  - file logs only.
  - or DB `audit_logs` for structured admin/content actions.
- Recommended implementation:
  - add `recordAuditLog(actor, action, details)` helper.
  - keep file logs for technical diagnostics.
  - use DB audit logs for admin/content/user actions.
- Add audit events for:
  - create/update/archive/restore exercise.
  - create/update/archive course.
  - import/export course/exercise.
  - user role/status/password changes.
  - guest import to account.
- Update logs UI:
  - structured audit tab/table.
  - optional file-log diagnostics tab.
- Add tests for audit insertion and access control.

Hotspots:

- `src/lib/server/db/schema.ts`
- `src/lib/remote/logs.remote.ts`
- `src/lib/logs/logger.ts`
- `src/routes/(app)/logs/+page.svelte`
- `src/lib/remote/courses.remote.ts`
- `src/lib/remote/exercises.remote.ts`
- `src/lib/remote/users.remote.ts`

Acceptance:

- Admin can inspect meaningful content/user changes.
- Audit table is either used or removed from claims.

## Phase 11: Import/Export Integration Tests

Goal: import/export works in real DB-backed flows, not only schema helpers.

Tasks:

- Add DB-backed round-trip tests:
  - export exercise and import it into a course.
  - export course with ordered exercises and import it.
  - verify exercise order is preserved.
- Verify safety defaults:
  - imported courses are unpublished.
  - imported exercises are unpublished.
  - invalid payloads produce safe errors.
- Test docs examples:
  - parse example JSON from docs or keep examples generated from fixtures.
- Add browser/E2E import path if Playwright is added.

Hotspots:

- `src/lib/import-export/transfers.ts`
- `src/lib/import-export/transfers.spec.ts`
- `src/lib/remote/courses.remote.ts`
- `src/lib/remote/exercises.remote.ts`
- `src/routes/(app)/cms/Courses.svelte`
- `src/routes/(app)/cms/Exercises.svelte`
- `docs/import-export.md`

Acceptance:

- Course/exercise transfer works through DB-backed import/export paths.
- Safety defaults are regression-tested.

## Phase 12: Seed And Demo Quality

Goal: seeded content is demo-ready, publish-valid, and curriculum-aligned.

Tasks:

- Add seed validation test/script:
  - temp DB.
  - `db:push`.
  - `db:seed`.
  - expected count: 2 courses, 10 exercises.
  - every published exercise passes validation.
- Add seed idempotency test:
  - run seed twice.
  - no duplicate rows.
- Review seeded exercise content:
  - age 8-12 clarity.
  - DE/EN grammar.
  - no grader jargon.
  - visible examples make sense.
- Verify curriculum claims:
  - loops.
  - conditions.
  - variables.
  - if “simple functions” is claimed anywhere, either implement function blocks/exercises or remove claim.
- Improve public demo progression and copy.
- Improve robot seed content after robot block/grader changes.

Hotspots:

- `scripts/seed.ts`
- `scripts/db-push.ts`
- `scripts/smoke.ts`
- `src/lib/types/exercise.ts`
- `src/routes/demo/+page.svelte`

Acceptance:

- Fresh environments seed deterministic, valid demo data.
- Public demo proves all three exercise types.

## Phase 13: i18n Completion

Goal: core app is consistently bilingual.

Tasks:

- Remove hardcoded user-facing English from:
  - `src/lib/components/DataTable.svelte`
  - `src/lib/components/ColumnPicker.svelte`
  - `src/lib/components/player/execution.svelte.ts`
  - `src/lib/components/Canvas2DEditor.svelte`
  - CMS/user/log/admin pages.
- Add all missing i18n keys to both `en.json` and `de.json`.
- Add translation coverage test:
  - every key in EN exists in DE.
  - every key in DE exists in EN.
  - no empty values for production keys.
- SSR document language now derives from locale cookie or `Accept-Language` and is covered by smoke.
- Add language-switch smoke coverage if browser tests are added.

Hotspots:

- `src/app.html`
- `src/hooks.server.ts`
- `src/lib/i18n/index.svelte.ts`
- `src/lib/i18n/en.json`
- `src/lib/i18n/de.json`
- `src/lib/components/**/*.svelte`
- `src/routes/**/*.svelte`

Acceptance:

- Main learner, CMS, users, logs, settings, and auth flows have DE/EN strings.
- Translation key drift is tested.

## Phase 14: Accessibility Completion

Goal: keyboard and screen-reader support is intentional.

Tasks:

- Canvas accessibility:
  - add accessible name/description.
  - add text fallback with task/position/target info.
  - provide keyboard alternatives for authoring if feasible.
- Icon-only buttons:
  - add `aria-label` to CMS course/exercise action buttons.
  - add labels to column picker and table actions.
- Confirm modal:
  - add heading.
  - add `aria-labelledby`/`aria-describedby`.
  - improve focus management.
- Forms and validation:
  - ensure labels are associated with inputs.
  - validation errors are announced or clearly tied to fields.
- Destructive actions:
  - confirm guest clear data.
  - confirm dangerous user changes if still inline.
- Optional browser a11y testing:
  - add `axe-core` if Playwright is added.

Hotspots:

- `src/lib/components/Canvas.svelte`
- `src/lib/components/ConfirmModal.svelte`
- `src/routes/(app)/cms/Courses.svelte`
- `src/routes/(app)/cms/Exercises.svelte`
- `src/routes/demo/+page.svelte`
- `src/routes/(app)/users/+page.svelte`
- `src/lib/components/ColumnPicker.svelte`
- `src/lib/components/DataTable.svelte`

Acceptance:

- Core controls are labeled.
- Destructive actions are confirmed accessibly.
- Known third-party limitations are documented if they remain.

## Phase 15: Mobile And Tablet UX

Goal: children can complete exercises on tablet/small screens.

Tasks:

- Learner player mobile layout:
  - replace dense three-panel flow with tabs/accordion on small screens.
  - suggested tabs: task, blocks, result.
  - keep run/check/submit actions reachable.
- Reduce nested scrolling friction in Blockly/result/canvas panels.
- CMS mobile polish:
  - wrap filters/import buttons.
  - reduce crowded table action rows.
  - ensure file import/export buttons remain reachable.
- Canvas/Blockly touch verification:
  - pointer events already exist for canvas; verify behavior on tablet.
  - coordinate scaling remains correct after CSS scaling.
- Manual device checklist:
  - phone width.
  - tablet width.
  - desktop.

Hotspots:

- `src/lib/components/player/ExercisePlayer.svelte`
- `src/lib/components/player/CoursePlayer.svelte`
- `src/lib/components/player/ExecutionArea.svelte`
- `src/lib/components/player/ResultsPanel.svelte`
- `src/lib/components/Canvas.svelte`
- `src/routes/(app)/cms/Exercises.svelte`
- `src/routes/(app)/cms/Courses.svelte`
- `src/routes/(app)/users/+page.svelte`
- `src/routes/(app)/logs/+page.svelte`

Acceptance:

- Demo exercises are usable on tablet without layout breakage.
- Small screens do not hide the primary next action.

## Phase 16: Browser E2E And Smoke Coverage

Status: focused Playwright coverage and local Docker production smoke have been added.

Goal: final end-to-end claims are backed by automation.

Tasks:

- Focused Playwright scenarios now cover:
  - public login/demo route loading.
  - protected `/test` redirect.
  - German SSR language rendering.
  - guest opens a seeded demo course in the learner player.
  - seeded teacher signs in and reaches CMS.
  - mobile, tablet and desktop public-page horizontal overflow checks.
- Still optional if time remains:
  - guest completes one exercise.
  - guest progress survives reload.
  - CMS creates or edits an exercise.
  - CMS previews and publishes valid exercise.
  - course ordering persists.
  - analytics export returns/downloads data.
- Expand `scripts/smoke.ts`:
  - validate seeded public demo data exists.
  - load a public course via app route or remote endpoint if feasible.
  - check one export path if feasible without browser automation.
- Docker runtime smoke now builds the prod image, starts Compose with temp data/log directories,
  requests `/login`, `/demo` and guarded `/test`, verifies mounted DB/log paths and cleans up.
- Update CI based on runtime budget:
  - keep lint/check/test/build/smoke.
  - keep Compose config validation.
  - optionally add Docker build/runtime smoke.

Hotspots:

- `package.json`
- `scripts/smoke.ts`
- `.github/workflows/verify.yml`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- Playwright config if added.

Acceptance:

- At least one learner, one guest, one teacher, and one export path is covered by browser or smoke automation.
- Docker runtime is tested locally or CI explicitly documents why it is manual-only.

## Phase 17: Final Verification Gate

Goal: one repeatable final-submission checklist.

Required commands:

1. `bun install --frozen-lockfile`
2. `bun --bun run db:push`
3. `bun --bun run db:seed`
4. `bun --bun run lint`
5. `bun --bun run check`
6. `bun --bun run test`
7. `bun --bun run test:e2e`
8. `bun --bun run build`
9. `bun --bun run smoke`
10. `bun --bun run docker:smoke`
11. `docker compose -f docker-compose.dev.yml config`
12. `BETTER_AUTH_URL=http://localhost:3000 AUTH_SECRET=$(openssl rand -base64 32) docker compose -f docker-compose.prod.yml config`

Acceptance:

- Every final claim has implementation, test coverage, or a documented limitation.
- The verification output is recorded for final submission.

## Recommended Implementation Order

1. Phase 0: report/docs truth alignment.
2. Phase 1: DB reproducibility and migration cleanup.
3. Phase 2: attempt integrity and guest/auth parity tests.
4. Phase 3: route/access matrix tests.
5. Phase 4: publish validation completion.
6. Phase 5: robot distinctiveness.
7. Phase 6: sandbox/security hardening decision.
8. Phase 7: auth/account flow decisions.
9. Phase 8: settings page completion or removal.
10. Phase 9: analytics UI/export depth.
11. Phase 10: audit logs.
12. Phase 11: import/export integration tests.
13. Phase 12: seed/demo quality.
14. Phase 13: i18n completion.
15. Phase 14: accessibility completion.
16. Phase 15: mobile/tablet UX.
17. Phase 16: browser E2E and Docker runtime smoke.
18. Phase 17: final verification gate.

## Highest Priority Next Actions

1. Decide whether stronger server grading isolation is required or document `node:vm` as a limitation.
2. Finish robot/mobile/device validation if the final demo will emphasize tablet classroom use.
3. Complete remaining i18n/accessibility polish after core correctness gaps are closed.
4. Expand Playwright coverage for full exercise completion/CMS/export flows only if time remains.

## Explicit Remaining Weakness Register

These are the known weak points that should not be forgotten:

- Report TODOs were removed, but final prose should still be reviewed against the app before submission.
- DB migrations are not a trustworthy arbitrary old-database production upgrade chain; `db:push` is the documented setup path.
- Docker production runtime smoke now passes locally, but CI still only validates Compose config.
- Browser E2E coverage is installed and focused; full learner/CMS/export flows are not exhaustive.
- Imported guest attempts are stored as user attempts with origin only in analytics metadata.
- Server authoritative grading uses in-process `node:vm`.
- Public course play is via `/demo`, not general unauthenticated `/courses`.
- Analytics UI is basic compared with collected metrics.
- Some hardcoded English remains in server errors and inactive/backup code.
- Canvas accessibility has been improved, but real assistive-technology testing is still missing.
- Mobile/tablet learner layout needs real device validation.
