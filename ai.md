# BlockQuiz Gap Analysis

Date: 2026-03-08

This report compares three things:

1. The implemented code in `code/`
2. The currently compiled thesis/report in `report/`
3. The larger thesis draft in `report-ai/`

It answers one question: what is still missing, incomplete, broken, or overstated?

## 1. Executive Summary

The project is not an empty prototype anymore. It already contains a substantial implementation:

- authentication and roles
- database schema with courses, exercises, attempts, and translations
- a CMS for courses and exercises
- a learner-facing course player
- Blockly integration
- turtle/canvas execution and grading
- a client-side iframe sandbox
- Docker files
- multiple unit tests

However, the project is also not thesis-ready in its current state.

The main gaps are:

- the compiled thesis in `report/` is still missing most chapters
- the codebase currently does not pass `bun run check`
- the I/O exercise type is declared, but not actually finished end-to-end
- guest mode/local-only learner mode is still missing
- analytics/export/evaluation are mostly not implemented
- seeded example content is inconsistent and currently broken
- several claims in the thesis draft are stronger than what the code currently proves

## 2. What Is Already Implemented

These parts are clearly present in the codebase:

### Core platform

- Better Auth based login/session handling
- role fields for `student`, `teacher`, `author`, `admin`
- DB tables for users, courses, exercises, attempts, audit logs, translations
- protected app routing and login flow

### Authoring / CMS

- CMS pages for courses and exercises
- exercise editor with localized content
- toolbox selection
- canvas-based authoring support for paths, targets, and walls
- hints and test-case configuration
- course to exercise assignment
- course to user assignment

### Learner flow

- student course overview
- course player
- per-exercise navigation
- result panel and hint panel
- attempt submission and progress lookup

### Exercise runtime

- Blockly workspace component
- turtle engine
- robot engine scaffold
- sandbox iframe executor in `static/sandbox.html` and `src/lib/sandbox/`
- turtle/canvas grading logic

### Delivery / operations

- `Dockerfile`
- `docker-compose.dev.yml`
- `docker-compose.prod.yml`
- unit tests for turtle/canvas/grading logic

## 3. What Is Missing Or Incomplete In The Code

## 3.1 Critical gaps

### A. The codebase is currently not in a clean, shippable state

Verification:

- `bun run test` does not fully pass
- `bun run check` fails

Observed status:

- 97 tests passed
- 1 test suite failed because `src/lib/sandbox/sandbox.test.ts` imports `bun:test`, while the project test runner is Vitest
- `bun run check` reported 42 errors and 29 warnings

This is the most important gap, because it means the current implementation cannot be presented as stable or fully validated.

### B. I/O exercises are not actually implemented end-to-end

The project claims support for `io`, `turtle`, and `robot`, but the real model is still canvas-first.

Evidence:

- `code/src/lib/types/exercise.ts` defines exercise type `io`
- the same file only defines canvas-based config and canvas-oriented grader settings
- `code/src/lib/components/player/ExecutionArea.svelte` shows only a placeholder output area for `io`
- no real I/O execution/grading pipeline is wired into the learner flow

Conclusion:

- I/O exists in naming and type declarations
- I/O does not exist as a complete usable feature

### C. Guest mode is still missing

The original scope repeatedly mentions guest mode or local-only usage. That is not implemented in a complete form.

Evidence:

- protected routes redirect unauthenticated users to `/login`
- attempts are submitted through authenticated user flows
- there is a public `/demo`, but this is a playground, not a guest learning mode with progress persistence/import/export
- no complete LocalStorage/IndexedDB guest-progress flow was found

Conclusion:

- demo mode exists
- real guest mode does not

### D. Example/seed content is not ready

The platform architecture exists, but content completeness is weak.

Evidence:

- `code/scripts/seed.ts` is inconsistent with the current schema and appears outdated/broken
- the project goal of curated exercises is not supported by a reliable seed pipeline
- no trustworthy set of 10 finished, thesis-ready exercises is visible from the current seed setup

Conclusion:

- the platform shell exists
- the exercise corpus needed for the thesis MVP is still missing or not in a reproducible state

## 3.2 Important but secondary gaps

### E. Robot exercise type is only partial

The `Robot` engine exists, but it is currently just a light extension of `Canvas2D` with no meaningful robot-specific block set or grading specialization.

This means the project currently has:

- one strong exercise family: turtle/canvas
- one declared but thin extension: robot

### F. Reporting and analytics are only partial

What exists:

- attempts are stored
- progress can be computed per course

What is still missing:

- export for teachers/admins as CSV/JSON
- meaningful aggregated dashboards
- pseudonymized research export workflow
- hint usage / detailed learning analytics reporting aligned with the thesis claims

### G. Import/export and content portability are missing

The requirements and drafts mention JSON import/export and reusable content workflows.

I did not find a complete import/export path for:

- exercises
- courses
- guest progress

### H. Versioning exists only partially

There is an `exerciseVersions` table in the schema, but the implementation does not appear to expose a complete draft/publish/version-history workflow in the UI.

### I. Internationalization is present but inconsistent

There is real i18n support in the code, but the system is not as clean as the thesis text suggests.

Observed problems:

- mixed/custom i18n approach instead of one clearly finished architecture
- `code/src/lib/remote/i18n.remote.ts` imports from a non-existing `$server/db`
- some UI text is still hardcoded in English
- the thesis draft mentions Paraglide, but the current implementation uses a custom `src/lib/i18n/index.svelte.ts`

Conclusion:

- bilingual support exists in principle
- the implementation is not yet consistent enough to describe as fully finished

### J. Accessibility work is incomplete

`bun run check` reports multiple accessibility warnings, including:

- labels not associated with controls
- autofocus usage

That means accessibility should be described as partial, not finished.

## 3.3 Technical debt / broken areas found by static checks

The check output points to real inconsistencies, not just polish issues.

Examples:

- duplicate `user` import in `code/src/lib/remote/auth.remote.ts`
- missing component export target in `code/src/lib/components/player/index.ts`
- broken or outdated imports in `code/src/lib/remote/i18n.remote.ts`
- type mismatches in `users.remote.ts`, `exercises.remote.ts`, `player/executor.ts`, `graders/turtle.ts`
- typo `cass` instead of `class` in `code/src/+error.svelte`
- Blockly typing/API mismatch in `BlocklyWorkspace.svelte`

These issues matter because they weaken any thesis claim about correctness, maintainability, or production readiness.

## 4. What Is Missing In The Written Thesis / Report

## 4.1 The compiled thesis in `report/` is still structurally incomplete

The currently compiled `report/main.tex` only includes:

- Abstract
- Acknowledgments
- Introduction
- Background and Related Work

It does not currently include:

- requirements analysis
- system design
- implementation
- evaluation
- conclusion

So the most immediate writing gap is not wording quality, but missing thesis chapters.

## 4.2 `report-ai/` is much more complete, but it is still not final

`report-ai/main.tex` already contains draft chapters for:

- system design
- implementation
- evaluation
- conclusion

But it is still not thesis-ready because:

- evaluation results are placeholders
- some claims are stronger than the current code supports
- some descriptions no longer match the real codebase

## 4.3 The abstract currently overclaims

The current abstract/draft text claims or strongly implies:

- two implemented exercise types including I/O
- learning analytics capture
- an evaluation with target users demonstrating effectiveness

These claims are not fully supported by the current repository state.

The abstract should be revised unless those parts are completed first.

## 4.4 The introduction and scope need alignment with the real implementation

At the moment, the written scope says the MVP includes:

- two exercise types
- ten curated exercises
- Docker deployment
- sandboxed execution
- evaluation/usability results

Realistically, the repository supports the following wording better:

- turtle/canvas is the main completed exercise type
- sandbox and Docker exist
- CMS and learner flow exist
- I/O is planned/partial
- evaluation is planned, not finished
- content set and guest mode are incomplete

## 5. Biggest Mismatches Between Code And Thesis Claims

These are the most important mismatches to fix before submission.

### Mismatch 1: Thesis says two mature exercise types; code mainly supports one

- turtle/canvas is real
- I/O is not finished
- robot is partial

### Mismatch 2: Thesis suggests evaluation results; repository shows no finished evaluation chapter/results

- `report/` has no evaluation chapter in the active build
- `report-ai/` contains evaluation placeholders, not finished results

### Mismatch 3: Thesis suggests polished, validated implementation; code still fails checks

- static analysis currently fails
- one test suite is incompatible with the chosen test runner

### Mismatch 4: Thesis suggests privacy-by-default guest use; code still depends mainly on authenticated flows

- no full guest progress workflow found

### Mismatch 5: Thesis suggests a complete exercise corpus; repository does not show a reliable finished seed dataset

## 6. Recommended Priority Order

If the goal is to finish the bachelor thesis efficiently, this is the most pragmatic order.

### Priority 1: Make the repository defensible

- fix `bun run check`
- fix the failing sandbox test suite
- remove stale/broken imports and exports
- decide which features are truly in scope and mark the rest clearly as future work

### Priority 2: Decide the honest MVP boundary

Two realistic options:

#### Option A: Narrow the thesis claims

Describe the project as:

- a turtle/canvas-first learning platform
- with CMS, learner flow, sandbox, auth, and Docker
- with I/O and advanced analytics left as future work

This is the safer option.

#### Option B: Finish the missing MVP pieces

At minimum:

- full I/O execution and grading path
- stable sample exercises
- guest mode or remove the guest-mode claim
- analytics/export or remove the claim

This is riskier but gives a stronger final result.

### Priority 3: Merge the thesis sources

Right now the writing is split between:

- `report/` as the active compiled thesis
- `report-ai/` as the more complete draft

That split should end. One thesis source should become the single truth.

### Priority 4: Rewrite thesis claims to match evidence

Especially:

- abstract
- introduction contributions
- implementation chapter
- evaluation chapter
- conclusion / future work

## 7. Final Assessment

The project has a strong core and is significantly further along than the old roadmap/status files suggest.

But the final gap is no longer “build the whole platform from scratch”.

The real missing work is:

- stabilize the code
- finish or explicitly de-scope the incomplete features
- align the thesis with the actual implemented state
- complete the missing thesis chapters and evaluation narrative honestly

In short:

- the platform foundation is real
- the thesis packaging is not finished
- the current claims need tightening unless more implementation is completed
