# Agent 0 Log And Architecture Contracts

Date: 2026-03-08
Role: Agent 0, Architecture Coordinator
Status: completed first coordination pass

## What I Did

I reviewed the execution plan and grounded the contracts in the current repository before changing anything else.

Files reviewed:

- `plan.md`
- `code/src/lib/types/exercise.ts`
- `code/src/lib/server/db/schema.ts`
- `code/src/lib/player/executor.ts`
- `code/src/lib/sandbox/types.ts`
- `code/src/lib/remote/courses.remote.ts`
- `code/src/hooks.server.ts`

Repository observations confirmed during this pass:

- the current exercise model is still canvas-first and does not truly support `io`
- attempts are currently too thin for replayable grading and analytics
- learner access is still mostly auth-only
- sandbox protocol exists, but is command-log oriented and not yet generalized for all exercise types
- the current player/execution layer is tightly coupled to canvas engines

No code files were changed during this Agent 0 pass other than this `agents.md` handoff.

## Frozen Source Of Truth

The implementation target is the `report-ai` MVP+ promise set, not the older `code/old/*` plans.

Execution convention for all agents:

- always use Bun for package management and script execution
- use `bun install`, `bun run ...`, and `bun --bun run dev` where applicable
- do not introduce new `npm`, `pnpm`, or `yarn` commands into active docs, scripts, or workflows

The platform target remains:

- teacher CMS
- learner player
- `turtle`, `robot`, and `io` exercise types
- secure sandboxed execution
- guest mode plus authenticated mode
- attempts, progress, analytics basics, export
- DE/EN support
- Docker-ready deployment
- green checks, tests, and build

## Frozen Contracts

These are the contracts the other agents should implement against. They are now the decision baseline unless explicitly changed later.

### 1. Exercise Domain Contract

`Exercise` must become a discriminated union by `type`.

Shared fields across all exercise types:

- `id: string`
- `courseId: string`
- `type: 'io' | 'turtle' | 'robot'`
- `content: ExerciseContent`
- `toolbox: string[]`
- `starterXml: string`
- `hasStarterBlocks: boolean`
- `hints: ExerciseHint[]`
- `published: boolean`
- `order: number`
- `validation: PublishValidationResult`
- `createdBy: string`
- `createdAt: number`
- `updatedAt: number`

`ExerciseContent` stays localized:

- `title: { de: string; en: string }`
- `description: { de: string; en: string }`
- optional `image`
- optional localized worked example block

#### IO exercise config

`type: 'io'`

Config must contain:

- `io.mode: 'stdin-stdout'`
- `io.tests: IoTestCase[]`
- `io.normalization`
- optional `io.visibleExampleInput`
- optional `io.visibleExampleOutput`

`IoTestCase` contract:

- `id`
- `description`
- `visible`
- `stdin: string`
- `expectedStdout: string`
- optional `message`
- optional `seed`

`IoNormalization` contract:

- `trim`
- `collapseWhitespace`
- `caseInsensitive`
- `normalizeLineEndings`
- optional `decimalSeparator: '.' | ',' | 'either'`

#### Turtle exercise config

`type: 'turtle'`

Config must contain:

- `canvas.width`
- `canvas.height`
- `canvas.gridSize`
- `canvas.pathOverlay`
- `canvas.targets`
- `canvas.walls`
- `grader.testCases`
- `grader.appleTolerance`
- `grader.wallTolerance`

Allowed turtle test case kinds:

- `target`
- `state`
- `commands`
- `path`

#### Robot exercise config

`type: 'robot'`

Robot is frozen as a grid-based exercise, not a turtle alias.

Config must contain:

- `grid.width`
- `grid.height`
- `grid.cellSize`
- `grid.start`
- `grid.direction`
- `grid.walls`
- `grid.targets`
- optional `grid.collectibles`
- `grader.testCases`

Allowed robot test case kinds:

- `target`
- `state`
- `commands`
- `path`
- optional `collect`

### 2. Publish Validation Contract

Published exercises must pass validation before learners can access them.

`PublishValidationResult` contract:

- `valid: boolean`
- `issues: PublishValidationIssue[]`
- `validatedAt?: number`

`PublishValidationIssue` contract:

- `code: string`
- `severity: 'error' | 'warning'`
- `field: string`
- `message: string`

Blocking requirements for publish:

- localized title and description in `de` and `en`
- at least one test case
- at least one hidden test
- toolbox only contains allowed registered blocks
- starter XML is parseable if present
- type-specific config is complete

### 3. Attempt Contract

Attempts are the canonical source of learner progress, reporting, and export.

The DB-backed attempt record must be expanded to include:

- `id`
- `exerciseId`
- `userId?: string`
- `clientId?: string`
- `actorType: 'user' | 'guest'`
- `workspaceXml: string`
- `generatedCode: string`
- `resultJson: string`
- `locale: 'de' | 'en'`
- `startedAt: number`
- `endedAt: number`
- `score: number`
- `passed: boolean`
- `hintEventsJson: string`
- `analyticsJson: string`
- `createdAt: number`

Rules:

- authenticated learners always use `userId`
- guest learners always use `clientId`
- exactly one of `userId` or `clientId` must be present
- `resultJson` must be sufficient to re-display grading results without regrading
- `analyticsJson` is derived execution metadata, not raw private browser state

### 4. Guest Progress Contract

Guest mode is client-side only unless later linked to an account.

`GuestProgressExport` contract:

# Agent 1 Log And Stabilization Status

Date: 2026-03-08
Role: Agent 1, Stabilization And Type Health
Status: in progress

## Current Focus

I claimed the stabilization packet from `plan.md` and started from the current mechanical failures instead of feature work.

Initial verification findings:

- `bun run check` is not green because of mixed Vite/Vitest config typing, stale Svelte files, outdated remote form usage, and several server-side typing issues
- `bun test` is not green because `src/lib/sandbox/sandbox.test.ts` still imports `bun:test`
- the working tree in `code/` already had unrelated local changes in `package.json`, `bun.lock`, and `logs/app.log`, so I am leaving those alone unless a stabilization fix requires touching `package.json`

## Next Steps

- fix config and test-runner issues first
- remove stale exports and half-migrated files from the type-check surface where appropriate
- patch the required Agent 1 hotspots in the remotes and Blockly workspace
- re-run `bun run check` and `bun test`

- `version: 1`
- `clientId: string`
- `exportedAt: number`
- `courses: GuestCourseProgress[]`
- `attempts: GuestAttemptSnapshot[]`

`GuestAttemptSnapshot` contract mirrors the attempt contract but stays client-side.

Rules:

- guest data persists in browser storage
- guest export/import is plain JSON
- importing guest progress must merge by `exerciseId` and preserve the best attempt plus history
- linking to an account is an explicit later action, never automatic

### 5. Sandbox Runtime Contract

Execution ownership is frozen as:

- sandbox/execution layer executes learner code
- graders evaluate execution output
- player only orchestrates UX

The sandbox message protocol must support all exercise types.

Parent to sandbox:

- `execute`
- `reset`

Execute payload must include:

- `id`
- `code`
- `exerciseType`
- `apiMethods`
- `timeout`
- `maxCommands`
- `maxIterations`
- optional `seed`
- optional `stdin`

Sandbox result payload must include:

- `id`
- `success`
- `error?`
- `errorType?`
- `trace`

`ExecutionTrace` contract:

- for `turtle` and `robot`:
  `commands`, `finalState`
- for `io`:
  `stdout`, optional `stderr`, optional `prints`
- common:
  `durationMs`

Normal learner execution must not use raw `new Function` or direct local execution outside the sandbox path.

### 6. Grader Result Contract

All graders must return the same shape:

- `passed: boolean`
- `score: number`
- `totalTests: number`
- `passedTests: number`
- `testResults: GraderTestResult[]`

`GraderTestResult`:

- `id`
- `description`
- `visible`
- `passed`
- `message`
- optional `expected`
- optional `actual`

Rules:

- graders must be pure
- graders must be deterministic for the same config, input, and seed
- UI code must not contain grading logic

### 7. Reporting And Export Contract

Attempts are the only analytics source of truth.

Reporting views and export files must derive from attempts and course/exercise metadata.

Minimum analytics payload per attempt:

- attempt count
- elapsed time
- hint usage count and reveal timestamps
- exercise type
- locale
- pass/fail
- score
- block usage summary where available

Minimum export formats:

- JSON export with full machine-readable structure
- CSV export with flat teacher/admin fields

No summary tables should become a competing source of truth.

### 8. Access Contract

Teacher/admin paths remain protected.

Public learner access must allow:

- login page
- demo page
- public published courses for guest play

Protected-only areas:

- CMS
- user management
- logs
- settings that affect system state

The current `hooks.server.ts` public route model will need to be expanded by later agents to support guest play.

## DB Ownership Decisions

The existing DB backbone remains valid:

- `users`
- `courses`
- `course_exercises`
- `course_users`
- `exercises`
- `exercise_versions`
- `attempts`
- `audit_logs`
- `translations`

Required schema changes later:

- `attempts` must be expanded
- `exercises.config` must support the discriminated config union
- `exercises` or `exercise_versions` must store publish validation snapshot if the UI needs historical validation state

No new summary table for analytics should be introduced in the first completion pass.

## Dependency Map For Other Agents

### Agent 1

Can start immediately.

Inputs:

- this document

Outputs required before broad feature merge:

- green type/check/test baseline

### Agent 2

Starts after this document.

Inputs:

- frozen exercise, attempt, validation contracts

Outputs:

- updated types
- migrations
- schema-aligned seed path

Blocks:

- Agents 4, 5, 6, 7, 8, and 9 from finalizing

### Agent 3

Can prepare early, but final implementation depends on Agent 2 attempt and guest contracts.

### Agent 4

Can refactor the sandbox internals early, but final runtime payloads must follow the contracts above and the Agent 2 schema outputs.

### Agent 5

Depends on:

- Agent 2 exercise config
- Agent 4 execution trace contract

### Agent 6

Depends on:

- Agent 2 type model
- Agent 5 grader result shape for preview

### Agent 7

Depends on:

- Agent 3 guest/auth flow
- Agent 4 runtime
- Agent 5 graders

### Agent 8

Depends on:

- Agent 2 expanded attempts
- Agent 7 final attempt submission flow

### Agent 9

Depends on:

- Agent 2 schema
- Agent 5 graders
- Agent 6 authoring/publish validation

### Agent 10

Can run a baseline cleanup after Agent 1.

Final pass should happen after Agents 6, 7, and 8.

### Agent 11

Best run after Agents 1, 2, 4, 5, and 9 are stable.

## Merge Order

1. Agent 1 stabilizes checks/tests and removes stale breakage.
2. Agent 2 lands the canonical type/schema/migration contract.
3. Agent 4 lands the sandbox/runtime contract.
4. Agent 5 lands grader unification.
5. Agent 3 lands guest/auth split on top of the new attempt model.
6. Agent 6 lands CMS/editor changes on top of the new exercise model.
7. Agent 7 lands learner player integration using final runtime and grader APIs.
8. Agent 8 lands analytics/reporting/export using canonical attempts.
9. Agent 9 lands seeds and curated content.
10. Agent 10 performs i18n/accessibility consistency pass.
11. Agent 11 validates deployment, headers, CI, and startup paths.

## Conflict-Reduction Rules For All Agents

- Do not redesign the contracts above locally.
- Use the discriminated union model, do not extend the old canvas-first model with more optional fields.
- Do not add parallel reporting summary tables.
- Do not reintroduce local non-sandbox learner execution in the main path.
- Do not make guest mode server-dependent.
- Keep UI logic separate from grading logic.
- Keep remotes thin; domain logic belongs in typed modules, not route components.

## Immediate Follow-Up Work

Recommended next active thread:

- Agent 1 first, because the repo must stop failing checks before feature work can merge safely.

Recommended first follow-up after Agent 1:

- Agent 2, because the current exercise and attempt models block almost every other feature lane.

## Completion Criteria For Agent 0

Agent 0 is complete for this pass because:

- the current repository shape was reviewed
- the architecture contracts are frozen
- the dependency map is explicit
- the merge order is explicit
- downstream agents can now implement without inventing core data model decisions
