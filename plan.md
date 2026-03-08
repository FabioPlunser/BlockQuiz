# BlockQuiz Code Completion Plan

Always use bun!! 
## Summary

Source of truth: `report-ai` MVP+.
Execution strategy: stabilize first, then expand features.

Target end state:
- fully working teacher CMS
- fully working learner experience
- three supported exercise types: `turtle`, `robot`, `io`
- secure client-side execution with deterministic grading
- guest mode plus authenticated mode
- progress tracking, analytics basics, export
- consistent DE/EN support
- Docker-ready deployment
- green `bun run check`, `bun run test`, build, and basic end-to-end coverage

This plan is split into small agent-sized work packets with explicit ownership, inputs, outputs, dependencies, and acceptance criteria so multiple agents can run in parallel with low merge risk.

## Shared Contracts To Freeze First

Before feature work starts, one coordinating agent defines and publishes these contracts for the rest of the threads:

- Canonical exercise model in [exercise.ts](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/types/exercise.ts):
  `Exercise` uses a discriminated union by `type: 'io' | 'turtle' | 'robot'`.
- Canonical DB ownership in [schema.ts](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/server/db/schema.ts):
  exercises, courses, course assignments, attempts, translations, audit logs remain the main storage backbone.
- Canonical runtime split:
  sandbox/execution owns code execution, graders own deterministic evaluation, player owns UX only.
- Canonical report/export split:
  attempts are the source of truth; dashboards and exports derive from attempts, not duplicated summary tables.
- Canonical guest mode:
  guest progress is client-side exportable JSON and never required server-side unless the user later links an account.

Required target model decisions:
- `ExerciseContent` stays localized with `de` and `en`.
- `ExerciseConfig` becomes type-specific:
  `io` gets input/output and normalization config.
  `turtle` and `robot` get canvas/grid config plus graphical test config.
- `Attempt` must persist enough data to reproduce grading:
  exercise id, actor id or guest id, workspace XML, generated code snapshot, result JSON, started/ended timestamps, hint usage, locale.
- `Robot` is treated as a grid-based exercise, not just a renamed turtle.
- Hidden tests are mandatory for published exercises.
- Published content must pass validation before it is runnable by students.

## Parallel Work Packets

## Agent 0: Architecture Coordinator

Context:
- Current domain and schema are spread across [exercise.ts](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/types/exercise.ts), [schema.ts](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/server/db/schema.ts), and the remote functions in `src/lib/remote/`.

Goal:
- produce the final contract decisions the other agents implement against.

Deliverables:
- final type/schema contract for exercises, attempts, guest progress, analytics export
- dependency map for all other agents
- merge order and conflict-resolution rules

Done when:
- every other packet below can be implemented without local design decisions
- contracts are documented in one short engineering note inside the repo after implementation mode starts

## Agent 1: Stabilization And Type Health

Context:
- current repo already has working pieces, but `bun run check` fails heavily and one sandbox test imports `bun:test`.
- current hot spots include auth remotes, users remotes, i18n remote, player exports, Blockly typing, and stale files.

Goal:
- make the repo mechanically healthy before feature expansion.

Scope:
- fix all TypeScript/Svelte check errors
- fix test-runner incompatibility
- remove or quarantine stale/broken files that poison checks
- align imports/aliases and remove dead references
- keep behavior unchanged unless a bug fix is required

Must touch first:
- [auth.remote.ts](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/remote/auth.remote.ts)
- [users.remote.ts](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/remote/users.remote.ts)
- [i18n.remote.ts](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/remote/i18n.remote.ts)
- [BlocklyWorkspace.svelte](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/components/BlocklyWorkspace.svelte)

Done when:
- `bun run check` is green
- `bun run test` is green under the chosen runner
- no stale barrel export points to missing files
- no route/component required by the app is left in a broken half-migrated state

Dependency:
- none; this is first

## Agent 2: Exercise Domain Model And DB Migration

Context:
- current exercise model is canvas-first and does not cleanly support `io`.
- current seed script appears out of sync with the live schema.

Goal:
- redesign the data model so all promised exercise types are first-class and stable.

Scope:
- convert `ExerciseConfig` into a discriminated union
- separate shared authoring fields from type-specific runtime/grader fields
- add any missing DB columns or JSON shapes for:
  workspace snapshot, generated code snapshot, hint usage, guest/client id, exercise metadata, publish validation status
- make the seed script and all remote functions use the same model
- define migration path from current rows

Required target shape:
- shared exercise fields:
  id, courseId, type, localized content, toolbox, starterXml, hints, published, order, created/updated metadata
- `io` config:
  visible/hidden tests, optional stdin, expected stdout, normalization options, case/whitespace/decimal behavior
- `turtle` config:
  canvas config, target/path/state/commands tests, tolerances
- `robot` config:
  grid config, walls/targets/objectives, robot-specific test cases
- publish validator result:
  machine-readable list of blocking issues

Done when:
- one canonical type model is used by remotes, CMS, player, grading, and seeds
- migration can transform current stored exercises without manual editing
- no feature code needs `as unknown as` to force invalid shapes

Dependency:
- start after Agent 0 publishes contracts
- should complete before Agents 4, 5, 6, 7, 8, 9 finalize

## Agent 3: Auth Mode Plus Guest Mode

Context:
- current app is mostly authenticated and redirects unauthenticated users to login.
- `/demo` exists but is not a true guest learner flow.

Goal:
- support both authenticated learners and guest learners cleanly.

Scope:
- keep existing account mode
- add guest course/exercise play mode without login
- persist guest progress locally
- support export/import of guest progress JSON
- support optional migration of guest progress into an account after login
- ensure protected teacher/admin routes stay protected

Required behavior:
- guests can open public/published courses
- guests can run, submit, receive grading, reveal hints, and resume progress locally
- authenticated learners continue storing attempts in DB
- shared player UI must work in both modes

Done when:
- login is no longer required for the public learner path
- guest state survives reloads
- guest export/import round-trip works
- account-only and role-restricted areas still require auth

Dependency:
- depends on Agent 2 contracts for attempt and guest-progress shape
- can run in parallel with Agents 4, 6, 7 once the contract is frozen

## Agent 4: Sandbox And Execution Runtime

Context:
- sandbox foundations already exist in [SandboxExecutor.ts](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/sandbox/SandboxExecutor.ts) and [sandbox.html](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/static/sandbox.html).
- current player executor is partially wired for graphical tasks only.

Goal:
- make execution secure, deterministic, and reusable across all exercise types.

Scope:
- formalize the postMessage protocol
- support execution for `io`, `turtle`, and `robot`
- enforce timeout, loop trap, command limit, and blocked-global policy
- verify `postMessage` origin/source on both sides and stop using wildcard trust for sandbox control messages
- add a request nonce or equivalent handshake so unrelated windows cannot spoof sandbox `ready`/`result` messages
- normalize runtime errors into user-facing categories
- record execution trace needed by graders
- remove any remaining unsafe learner execution path from the normal flow

Required behavior:
- `turtle` and `robot` return command logs plus final state
- `io` returns stdout/stderr-equivalent output payloads
- runtime is deterministic and independent of ambient browser globals
- no normal learner flow uses raw `new Function` outside the sandbox

Done when:
- one execution entrypoint is used by all exercise players
- sandbox tests cover protocol, limits, blocked APIs, and error mapping
- runtime contract is documented for Agent 5 and Agent 7

Dependency:
- depends on Agent 2 contract
- should finish before Agent 7 final integration

## Agent 5: Graders And Deterministic Evaluation

Context:
- current turtle/canvas grading exists, but `io` is not complete and `robot` is thin.
- grading logic must be pure and replayable.

Goal:
- build the final grader suite for all promised exercise types.

Scope:
- finish `io` grader
- harden turtle grader
- build real robot grader
- unify result format across graders
- support visible and hidden tests
- support per-test messages, total score, pass/fail, and partial credit
- support seeded randomness where tests need variation

Required result shape:
- `passed`
- `score`
- `totalTests`
- `passedTests`
- `testResults[]` with visibility, localized description/message, expected vs actual where safe to expose

Required coverage:
- normalization rules for `io`
- target/state/path/commands grading for turtle/robot
- deterministic grading for repeated runs with the same seed

Done when:
- all graders are pure functions over execution output plus exercise config
- no UI code contains grading logic
- unit coverage is strong enough to trust refactors

Dependency:
- depends on Agents 2 and 4 contracts
- can run mostly parallel with Agent 6

## Agent 6: CMS And Authoring Completion

Context:
- CMS already exists in [cms/+page.svelte](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/routes/(app)/cms/+page.svelte) and related editor components.
- current editor is strongest for turtle/canvas.

Goal:
- make authoring complete for all promised exercise types.

Scope:
- finalize course editor
- finalize exercise editor for `io`, `turtle`, and `robot`
- add publish validation UI
- add preview mode using the real runtime and graders
- add clone/archive flow
- add import/export for exercises and courses
- expose versioning history if kept in scope by Agent 2

Required behavior:
- authors can create a valid exercise without hand-editing JSON
- `io` authoring is first-class, not hidden behind turtle-specific UI
- published exercises must contain complete localized text, a valid toolbox, hints, and hidden tests
- preview uses the same runtime as learners

Done when:
- a teacher can create, preview, publish, clone, export, import, and assign exercises/courses end to end
- no authoring screen assumes only turtle config exists

Dependency:
- depends on Agent 2 contracts
- benefits from Agent 5 grader result contract
- can proceed in parallel with Agent 7 once contracts are fixed

## Agent 7: Learner Player, Progress, And UX

Context:
- learner flow already exists in [CoursePlayer.svelte](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/components/player/CoursePlayer.svelte) and [ExercisePlayer.svelte](/Users/fabioplunser/Nextcloud/Uni/Bachelorarbeit/code/src/lib/components/player/ExercisePlayer.svelte).
- current experience is graphical-first and partly hardcoded.

Goal:
- deliver a clean, unified learner experience across guest/auth and all exercise types.

Scope:
- finish exercise presentation for `io`, `turtle`, and `robot`
- unify run/reset/submit/result flow
- make hint timing and hint reveal robust
- store progress and attempt state consistently
- keep hidden tests and authoritative pass/fail logic off the learner-visible payload path
- split learner preview from authoritative submission so persisted attempts are not accepted purely from client-reported score/pass/result JSON
- support course progression and resume behavior
- remove hardcoded English strings from learner-critical paths
- ensure the player uses shared runtime and grader contracts only

Required behavior:
- learners can solve each type without hidden dev assumptions
- visible tests and feedback are shown consistently
- guest and authenticated progress behave the same in the UI
- resume state after refresh works
- mobile/tablet layout remains usable

Done when:
- all published exercise types are playable from course selection to graded result
- UX behavior is identical whether attempts go to DB or local guest storage
- no exercise-specific hacks remain in shared player code

Dependency:
- depends on Agents 3, 4, and 5
- can start layout/state cleanup earlier, then wire final contracts later

## Agent 8: Analytics, Export, And Teacher Reporting

Context:
- attempts exist and course progress can already be derived, but reporting/export is minimal.

Goal:
- implement the “analytics basics” promised by the thesis without overbuilding.

Scope:
- record attempt-level analytics consistently
- capture hint usage, start/end time, pass/fail, score, exercise type, locale, block usage summary where feasible
- build teacher/admin export to CSV and JSON
- add lightweight reporting views for course progress and exercise outcomes
- keep PII handling minimal and privacy-first

Required behavior:
- exported data is sufficient for evaluation or classroom review
- guest mode never leaks into teacher reporting unless explicitly imported/linked
- analytics are derived from canonical attempt records

Done when:
- teachers can export course/exercise attempt data
- admin/teacher views show aggregate completion, pass rate, and attempt count
- schema and exports are documented for future research use

Dependency:
- depends on Agent 2 attempt shape
- depends on Agent 7 final attempt submission flow

## Agent 9: Example Content, Seeds, And Publishable Demo Data

Context:
- current seed content is stale and not trustworthy.
- thesis promises curated exercises covering core concepts.

Goal:
- create a reproducible content set that demonstrates the full platform.

Scope:
- rewrite seeding against the final schema
- create the promised curated exercises across loops, conditions, variables, simple functions
- include all three exercise types, but bias toward a strong turtle set if time is tight
- ensure DE/EN content, hints, hidden tests, and course packaging are complete
- create at least one public guest-playable demo course

Required content baseline:
- 10 curated exercises minimum
- enough `io` exercises to prove the type is real
- enough `robot` exercises to prove it is not just a placeholder
- at least one course with a coherent progression

Done when:
- a fresh environment can seed deterministic demo data
- seeded content passes publish validation
- seeded content is suitable for screenshots, demos, and evaluation

Dependency:
- depends on Agents 2, 5, and 6

## Agent 10: i18n, Accessibility, And UI Consistency

Context:
- current i18n is mixed and multiple accessibility warnings exist.
- some strings are hardcoded and some controls are not labeled correctly.

Goal:
- make the app consistently bilingual and pass a basic accessibility bar.

Scope:
- unify i18n usage across learner, CMS, auth, and reporting flows
- remove hardcoded strings where user-facing
- ensure form labels, focus order, keyboard access, and contrast are acceptable
- fix Blockly/container accessibility issues that are tractable within the app shell
- audit DE/EN fallback behavior

Required behavior:
- all primary learner and teacher flows are available in DE and EN
- publish validation should fail on missing required localized content
- accessibility warnings from current checks are eliminated or deliberately documented if third-party-limited

Done when:
- user-visible core flows contain no stray hardcoded English-only copy
- automated checks no longer report the current accessibility issues
- language switching does not break content rendering

Dependency:
- can run in parallel after Agent 1 stabilization
- final pass should happen after Agents 6, 7, and 8

## Agent 11: Deployment, Security Headers, And CI Hardening

Context:
- Docker files exist, but they need to be validated against the finished app.
- the final product needs a reliable “works from clean checkout” path.

Goal:
- finish the operational side so the app is actually deliverable.

Scope:
- validate and harden Docker dev/prod setup
- ensure DB bootstrapping and seed flow work
- add CSP/security headers consistent with the sandbox model
- harden auth endpoints with rate limiting, generic failure responses, and a real password-reset token flow that does not expose or reuse server-side verification records directly
- remove public account-enumeration helpers unless there is a concrete product need and equivalent abuse controls
- replace client-only HTML sanitization with a server-safe sanitization path or sanitize-on-write policy for rich text content
- create CI commands for check, test, and build
- document environment variables and privacy-sensitive defaults

Required behavior:
- fresh checkout can install, migrate, seed, run
- production container starts cleanly
- headers do not break the sandbox
- stored rich text cannot execute script during SSR or first paint
- sandbox and auth flows fail closed under malformed cross-window messages and auth abuse attempts
- the repo has a single canonical validation sequence

Done when:
- local and containerized startup both work from documented steps
- CI-equivalent command list is stable and green
- security defaults match the client-side sandbox design

Dependency:
- final hardening pass after Agents 1, 2, 4, 5, and 9

## Merge Order

1. Agent 0 publishes contracts.
2. Agent 1 lands stabilization first.
3. Agent 2 lands model/schema contract next.
4. Agents 4 and 5 land runtime and grader contracts.
5. Agents 3, 6, and 7 land on top of the frozen contracts.
6. Agent 8 lands analytics/export after attempt flow stabilizes.
7. Agent 9 lands content/seeds after authoring and grading are stable.
8. Agents 10 and 11 perform final cross-cutting hardening.
9. Final integration pass runs all checks, tests, seeds, and container validation.

## Test Plan

Required automated gates:
- `bun run check`
- `bun run test`
- production build
- one smoke path from login to course play
- one guest path from public course to resume after reload
- one author path from create exercise to preview to publish
- one export path for analytics/reporting
- seed-from-empty-database validation
- Docker dev and prod smoke validation

Required scenario coverage:
- `io` exercise with visible and hidden tests
- hidden tests never appear in learner-facing/public exercise payloads
- persisted attempt submission is rejected if the client forges pass/fail, score, or result payloads
- `turtle` path/target/state grading
- `robot` grid navigation with walls/targets
- guest progress export/import
- authenticated attempt persistence
- language switch in learner and CMS
- publish validation failure on incomplete exercise
- sandbox timeout and command-limit handling
- SSR render of authored rich text with hostile HTML payloads
- password reset abuse and account-enumeration regression checks

## Assumptions And Defaults

- We are implementing the full `report-ai` MVP+ promise set, not the maximal superset of optional future features.
- Evaluation-study execution is out of scope for code work; only the platform support needed for it is in scope.
- Plugin architecture beyond current extensibility hooks is not required for code completion unless already implied by the stabilized contracts.
- SSO is out of scope; email/password plus guest mode is the target auth model.
- `robot` must become meaningfully distinct from `turtle`, but it does not need a large simulator beyond a grid-based puzzle model.
- The final platform should prefer honest, stable scope over speculative extra features.
