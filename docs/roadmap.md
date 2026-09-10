# BlockQuiz Roadmap

A living plan of outstanding work. Update this file as items land; check it at the start of each session so we don't re-plan from scratch.

Current branch convention: small feature commits straight onto `dev`, each individually revertable.

---

## Status snapshot

| Area | State |
|------|-------|
| Theme system (light/dark/warm + pre-hydration) | ✅ shipped |
| Player state classes (`CoursePlayerState`, `ExercisePlayerState`) | ✅ shipped |
| `ExerciseEditorState` class refactor | ✅ shipped |
| Turtle start / finish / collision / apples | ✅ shipped (live reachability check + strict-fail) |
| BFS reachability + path generation | ✅ helpers exist; UI button dropped (revisit later) |
| CMS folder moved to `lib/components/cms/` | ✅ shipped |
| `courses.remote.ts` — badges + analytics extracted, getUserCourses BFS | ✅ shipped |
| Service-layer split for `courses.remote.ts` | ✅ shipped — file is ~214 LOC of thin wrappers; logic in `$lib/server/courses/{schemas,helpers,queries,mutations}.ts` |
| Vestigial validator + guest-import server code removed | ✅ shipped — `attempts/invariants.ts` (+ spec) deleted; mutations.ts writes `actorType: 'user'` directly |
| CMS UX (section nav, validation checklist, empty state, filter chip, card heights) | ✅ shipped |
| Container-query player layout | ✅ shipped |
| SSO + email transport + password-login mode | ✅ shipped |
| Schema: exercises are M:N with courses | ⏳ `exercises.courseId` still `NOT NULL` — see §2 |
| Seed data | ❌ uses hardcoded slugs + orphan-prone — see §1 |
| Guest demo (unauthenticated player path) | ❌ broken since CoursePlayer refactor — see §3 |
| Pure-helper specs (`grid`, `pathfinding`, `collision`, `course-analytics`) | ❌ — see §5 |
| Blockly workspace memory cache | ❌ — see §6 |
| `withAudit(meta, fn)` helper | ❌ — see §7 |

Pre-existing svelte-check warnings remain in `src/lib/components/ExportLogsModal.svelte` (a11y) — out of scope for now.

---

## 1. Seed regeneration

**Why now:** the current seed uses hardcoded slug ids (`intro-programming`, `io-double-it`, `demo-course`) and exercises whose `courseId` may reference courses that no longer exist after editing. That orphan state triggered the FK 404 we just patched server-side. A clean seed makes the M:N migration (§2) safe and gives teachers a working demo.

**Scope**
- Replace literal ids with `crypto.randomUUID()`.
- Seed via the new M:N relation: insert `courses`, `exercises`, then bridge through `courseExercises`. Don't write `exercises.courseId` once §2 lands.
- Every seeded exercise must pass `validateExercise(...)` — i.e. title, description, blocks, tests, and (for turtle) start + finish + reachability.
- Provide one course per type emphasis: a turtle course, a robot course, an I/O course. Plus a "mixed" course.

**Files**
- `scripts/seed.ts` (or wherever the seed lives — confirm by grep).
- New helpers may extract into `scripts/seed/courses.ts`, `scripts/seed/exercises.ts`.
- May need a `--reset` flag that wipes courses/exercises/attempts/courseExercises/courseUsers before seeding.

**Verification**
- `bun run db:reset && bun run db:seed` exits 0.
- `SELECT count(*) FROM exercises WHERE courseId IS NULL` matches expectations after §2.
- Open every seeded course in the CMS — all exercises render, every exercise's "Preview" is publishable.
- Open every seeded course as a student — full play-through works without console errors.

**Out of scope**
- Anonymizing test users.
- Multi-tenant seed.

---

## 2. M:N exercise schema (drop `exercises.courseId`)

**Why:** the user confirmed exercises live in many courses. `courseExercises` is the source of truth for membership; `exercises.courseId` is vestigial and actively dangerous (FK constraints fail on orphaned referents).

**Approach (3 commits)**

### 2a — Add Drizzle migration

`drizzle/0009_drop_exercise_courseId.sql` plus the snapshot. Because SQLite can `DROP COLUMN` on 3.35+ and Bun's SQLite is well above that, prefer the direct drop over the recreate-and-copy dance. Drizzle Kit will pick the right form when we update `src/lib/server/db/schema.ts`.

Schema change:
```ts
export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  // courseId removed — exercise membership is M:N via courseExercises
  type: text('type', { enum: ['io', 'turtle', 'robot'] }).notNull(),
  // …rest unchanged
});
```

### 2b — Code follow-ups

Files that touch `exercises.courseId`:
- `src/lib/remote/exercises.remote.ts`
  - `getExercises` filter: replace `row.courseId === filters.courseId` with a join through `courseExercises`.
  - `getExercisesByCourse`: read from `courseExercises` directly.
  - `createExercise` / `importExercise`: don't set `courseId` on insert. If created from a course context, also insert a `courseExercises` row.
  - `updateExercise` / `updateExerciseFromInput`: remove the `courseId` short-circuit (no longer needed; was load-bearing only because of the column).
  - `ensureCourseExists` may become unused; remove if so.
- `src/lib/types/exercise.ts` — drop `courseId` from `ExerciseBase` / `ExerciseFormData`, default factories.
- `src/lib/components/cms/ExerciseEditor.svelte` + `ExerciseEditorState.svelte.ts` — drop the `courseId` field from the form payload sent to create/update.
- `src/lib/components/cms/CourseEditor.svelte` — already manages course-exercise membership via `formData.exerciseIds`; no change.
- Migration step for any existing rows: if there is data we can't drop yet, first run a backfill that creates `courseExercises` rows for any exercise whose legacy `courseId` is not yet represented there. (Probably a no-op after §1 regenerates seed; check in production seed only.)

### 2c — Type cleanup pass

Once the column is gone:
- Remove the orphan-edit safety check that the FK fix added in `updateExerciseFromInput`. The comment in code points at this section — delete the comment too.
- Look for any remaining `exercise.courseId` references in components / utilities; should all be gone.

**Verification**
- `bun run check` clean.
- Create a turtle exercise from CMS Exercises tab (no parent course) → save succeeds, exercise has no row in `courseExercises`.
- Open a course, assign that exercise → `courseExercises` gets a row, course shows the exercise.
- Delete that course → exercise stays alive (no cascade), shows in CMS Exercises list, can be reassigned.
- Clone a course → cloned `courseExercises` rows reference the same exercises; editing one updates everywhere it's used (intentional under M:N).

**Out of scope**
- Distinguishing "exercise visibility / archive" per course.
- Per-course exercise ordering changes (already in `courseExercises.order`).

---

## 3. Guest demo parity

**Why:** `routes/demo/+page.svelte` passes legacy props (`course`, `exercises`, `persistAttempt`, …) to `CoursePlayer`, which the player state-class refactor no longer accepts. We patched typecheck with an `as unknown as { courseId; onBack }` cast and a TODO. The guest demo can't actually run.

**Approach options (pick one)**

A. **`mode: 'guest' | 'student'` prop on `CoursePlayer`** — single component, two data paths. Guest mode reads from `getPublicCourses` / `getPublicCourseExercises` and persists via `persistGuestAttempt` (localStorage). Student mode (default) keeps the current authed flow.

B. **Sibling `GuestCoursePlayer.svelte`** with its own state class — separation of concerns, more duplication.

**Recommend A.** The two flows differ only in (1) which queries fetch the data and (2) the attempt-persistence function. Branch on a `mode` prop in `CoursePlayerState.init()` and inject a `persistAttempt` callback.

**Files**
- `src/lib/components/player/CoursePlayer.svelte` — accept `mode`, `persistAttempt`, `initialProgress`, `initialSnapshots`, `initialExerciseIndex`, `onExerciseChange` props again (now typed).
- `src/lib/components/player/CoursePlayerState.svelte.ts` — branch on `mode`. In guest mode, skip the badge submission entirely (no auth → no user → no badges).
- `src/routes/demo/+page.svelte` — pass `mode="guest"` and remove the `as unknown as` cast.
- `src/lib/guest-progress/*` — confirm signatures still match.

**Verification**
- `/demo` loads `getPublicCourses` and shows public courses.
- Selecting one renders the player, exercises play, progress saves to localStorage.
- Logging in then opening `/courses/:id` continues to work unchanged.

---

## 4. Service-layer split for `courses.remote.ts` — ✅ done

**Landed:**
- `src/lib/server/courses/schemas.ts` — every zod input schema (createCourseSchema, updateCourseSchema, courseCloneSchema, courseArchiveSchema, importCourseSchema, submitAttemptSchema, hintRevealEventSchema, attemptAnalyticsSchema).
- `src/lib/server/courses/helpers.ts` — pure JSON sanitisers (sanitizeHintEventsJson, sanitizeAnalyticsJson, countHintEvents, parseAttemptAnalytics) and relation projections (mapCoursesWithRelations, loadPublishedCourseExercises, loadCoursePublishExercises, validatePublishedCourseInput).
- `src/lib/server/courses/queries.ts` — every read body: `loadStaffCourses`, `loadPublicCourses`, `loadCourseRow`, `loadCourseWithRelations`, `listAssignedCoursesForUser`, `loadCourseExercisesForMember`, `loadPublicCourseExercises`, `loadEarnedBadges`, `loadCourseProgress`, `loadCourseAnalytics`, `loadCourseAttemptsExport`, `loadCourseResearchExport`, `loadCourseExercisesForExport`. Permission-aware reads return a discriminated `{ reason: 'ok' | 'not-found' | 'not-member' | 'not-published' }` so the SvelteKit wrapper layer maps to `error(...)` cleanly.
- `src/lib/server/courses/mutations.ts` — every write body: `submitAttemptImpl`, `createCourseImpl`, `updateCourseImpl`, `deleteCourseImpl`, `cloneCourseImpl`, `archiveCourseImpl`, `restoreCourseImpl`, `importCourseImpl`. Each returns a `CommandResult<T>` discriminated by `success`.
- `src/lib/remote/courses.remote.ts` — **1089 → 214 LOC**. Each export is a 5–10-line wrapper: parse → auth check → call service → return.

## 4 (deprecated section kept for context)

**Why:** the file is still ~1100 lines and mixes zod schemas, DB queries, business helpers, and the SvelteKit wrappers. The natural shape is "thin remote function → service call." We already extracted badges and analytics; finishing the split shrinks each remote function to ~5–10 lines.

**Target tree**
```
src/lib/server/courses/
  schemas.ts          ← all zod input schemas
  queries.ts          ← loadCourse, listAssignedCoursesForUser, …
  mutations.ts        ← createCourse, updateCourse, archiveCourse, …
  badges.ts           ← (already extracted: src/lib/server/badges/evaluate.ts)
  analytics.ts        ← (already extracted: src/lib/analytics/course-analytics.ts)
```

`src/lib/remote/courses.remote.ts` shrinks to:
- imports
- thin `query()` / `command()` wrappers that parse input, check role, call service, return.

**Verification**
- `bun run check` clean; line count of `courses.remote.ts` < 400.
- Every existing route still works (CMS list, edit, publish, import/export, archive/restore, attempt submission, guest attempt import).

**Out of scope**
- Splitting by role into separate files (we decided one-file-per-domain).
- Discriminated-union return type for `getCourse` (the user chose to keep the implicit union — see §8).

---

## 5. Pure-helper specs

**Why:** `grid`, `pathfinding`, `collision`, `course-analytics` are pure, no Svelte runtime, easy to lock down with vitest.

**Files**
- `src/lib/canvas/grid.spec.ts`
- `src/lib/canvas/pathfinding.spec.ts`
- `src/lib/canvas/collision.spec.ts`
- `src/lib/analytics/course-analytics.spec.ts`

**Coverage targets**
- `cellOf`, `cellKey`, `pointsToCellSet`, `dedupePointsByCell`, `gridDimensions` — edge cases for `gridSize <= 0`, points exactly on cell boundary, deduplication preserves first.
- `checkReachability` — no-start / no-finish / start-on-wall / finish-on-wall / unreachable / start === finish / open path / 4-neighbour vs 8-neighbour assumption.
- `findShortestPath` — straight line, around a wall, none-when-blocked, single-cell case.
- `traceCollision` — clean segment, hits a wall cell head-on, glances a corner, zero-length segment.
- `computeCourseAnalytics` — empty input, single exercise, multiple exercises, locale aggregation, hint counts.

**Verification**
- `bun run test` — all specs pass.

**Out of scope**
- Specs for Turtle/Canvas2D engines (require runes — needs vitest svelte plugin set up first).

---

## 6. Blockly workspace memory cache (nice-to-have)

**Why:** Blockly's initial workspace injection is ~300–700 ms. Re-mounting on every preview / exercise switch is the real source of perceived slowness. The Loading skeleton hides it; caching would actually fix it.

**Approach**
- Keep a single off-screen Blockly workspace instance.
- On exercise change, `clear()` + load the new toolbox + starter XML.
- Avoid `bind:this` remounts; expose imperative `setExercise(exercise)` on the wrapper.

Defer until other items land — this is purely a perf win.

---

## 7. `withAudit(meta, fn)` helper

**Why:** every command in `courses.remote.ts` ends with a manual `await writeAuditLog({...})`. A thin wrapper cuts boilerplate and prevents accidentally forgetting an audit entry.

Likely lands together with §4 (service-layer split).

---

## 8. Type-safe role-aware `getCourse` (deferred)

**Why deferred:** the user chose to keep the implicit union ("just use it correctly") rather than introduce a discriminated `viewer: 'staff' | 'learner' | 'public'` tag. Revisit only if a real bug surfaces from mis-narrowing.

---

## 9. UI polish round (deferred fragments)

Not landed; revisit if non-technical-teacher feedback says they're needed:
- Sticky "Unsaved changes" save bar on the editor.
- `ConfirmModal` `tone="danger"` prop with red confirm button.
- List card single-row redesign.
- Warm theme fine-tuning across components beyond what DaisyUI inherits.

---

## Schema cleanup deferred (needs migration)

After removing server-side guest attempt import, two schema bits are vestigial:

- `attempts.actorType` enum keeps the `'guest'` value alongside `'user'`. No live code path inserts `'guest'`; the DB check constraint still enforces the (now unused) guest invariant.
- `attempts.clientId` column is only populated by `'guest'` rows. Live mutations always write `clientId: null`.
- `AttemptActorType = 'user' | 'guest'` in `$lib/types/attempt.ts` keeps the `'guest'` literal for legacy row shape.

A migration could drop the `'guest'` enum value, drop the `clientId` column, and simplify the check constraint, then narrow `AttemptActorType` to just `'user'`. Defer until the demo/guest path is settled — keeping the column makes it easier to reintroduce guest-account-import later if needed.

## Open questions to confirm before §2 lands

- **Drop or nullable?** User confirmed *drop* `exercises.courseId`. Going with drop.
- **Migrate existing data?** Seed gets regenerated in §1, so probably no production data to migrate. If a prod DB exists, add a one-shot backfill into `courseExercises` before dropping the column.

---

## Done & worth not regressing

- `.refresh()` after every mutation (delete/clone/archive/restore/import/save) — not `.updates(...)` (the latter requires server-side `requested()` plumbing).
- Container queries on the player, not viewport `xl:` breakpoints.
- Skip `evaluateAndPersistBadges` when the user has already passed this exercise.
- `$derived(query.current ?? …)` for SvelteKit remote queries, not `$derived(await query)`.
- New design tokens land as **new** DaisyUI themes, never edits to `light` / `dark`.
