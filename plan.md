# BlockQuiz Thesis — Writing Roadmap

## Chapter Status

| Chapter | File | Status |
|---|---|---|
| 1 Introduction | `sections/introduction.tex` | ✅ Written |
| 2 Background | `sections/background.tex` | ✅ Written |
| 3 Requirements Analysis | `sections/requirements.tex` | ⬜ Stub |
| 4 System Design | `sections/design.tex` | ⬜ Stub |
| 5 Implementation | `sections/implementation.tex` | ⬜ Stub |
| 6 Evaluation | `sections/evaluation.tex` | ⬜ Stub |
| 7 Conclusion | `sections/conclusion.tex` | ⬜ Stub |

---

## Chapter 3 — Requirements Analysis

### Sections to Write

**Stakeholders**
- Students (ages 8–12): need engaging, achievable challenges with immediate feedback; usability and age-appropriate design critical
- Teachers: need easy content creation without programming knowledge, progress tracking, minimal setup overhead
- School IT Administrators: require simple deployment, easy maintenance, GDPR compliance for Austrian schools

**Functional Requirements** (derived from DB schema + actual routes)

| ID | Requirement | Code Reference |
|---|---|---|
| FR-1 | Exercise model: `type='io'|'turtle'|'robot'`, toolbox whitelist, `starterXml`, hints, i18n content | `src/lib/types/exercise.ts:25–28` |
| FR-2 | Course management: ordered exercises, enrollment via `courseUsers` table | `src/lib/server/db/schema.ts` |
| FR-3 | Authoring/CMS: create/edit/publish exercises, preview, validation linter | `src/routes/(app)/cms/` |
| FR-4 | Sandbox execution: iframe isolation, 5s timeout, command count limit | `src/lib/sandbox/SandboxExecutor.ts:58–106` |
| FR-5 | Auto-grading: test-based for I/O, state-based for turtle/robot, score 0–100 | `src/lib/graders/index.ts` |
| FR-6 | Auth: email+password, role-based (student/teacher/author/admin) | `src/lib/server/auth.ts` |
| FR-7 | Audit logging: `auditLogs` table tracks all admin actions | `src/lib/server/db/schema.ts` |

**Non-Functional Requirements**

| ID | Requirement |
|---|---|
| NFR-1 | Privacy: no third-party services; self-hosted; GDPR compliance for Austrian schools |
| NFR-2 | Self-hostability: Docker container, SQLite (no external DB server needed) |
| NFR-3 | Age-appropriate UI: DaisyUI + Tailwind, simple navigation, visual feedback |
| NFR-4 | Localization: German + English (translations table in DB, locale per attempt) |
| NFR-5 | Performance: client-side Blockly rendering, SvelteKit server-side rendering |

**Citation opportunities:**
- `\cite{wing2006}` — computational thinking (justify FR-1 exercise types)
- `\cite{digitale_grundbildung}` — Austrian curriculum mandate (justify stakeholder needs)
- `\cite{read2008}` — child-computer interaction requirements (justify NFR-3, NFR-5)

---

## Chapter 4 — System Design

### Sections to Write

**Architecture Overview**
- SvelteKit full-stack, single-server deployment, SQLite
- No external services; all assets self-hosted

**Technology Decisions** (with rationale)

| Technology | Rationale | Citation |
|---|---|---|
| Blockly v12 | Only mature block-library for custom domain-specific blocks | `\cite{blockly}` |
| SvelteKit v2 + Svelte 5 | SSR + reactive runes, single framework for all routes | `\cite{sveltekit}` |
| SQLite + Drizzle ORM | Zero-config, type-safe queries, suitable for single-school deployments | `\cite{drizzle}` |
| Better Auth v1.5.4 | Session-based auth with role extension via `additionalFields` | — |

**Exercise Data Model**
- Discriminated union: `type: 'io'|'turtle'|'robot'`
- JSON `content` field: localized title/description
- JSON `config` field: type-specific grader configuration
- Reference: `src/lib/types/exercise.ts:25–28`, `src/lib/types/exercise.ts:192–210`

**Database Schema** (key tables)
- `exercises` — type, content (JSON), config (JSON), toolboxXml, starterXml, hints
- `courses` — metadata, ordered exercise list via `courseExercises`
- `attempts` — userId, exerciseId, workspace XML, grading result, score, timestamp
- `auditLogs` — admin action tracking
- `exerciseVersions` — snapshots for versioning
- `translations` — custom i18n table (NOT Paraglide; locale lookup at runtime)
- Reference: `src/lib/server/db/schema.ts:7–173`

**Sandbox Design**
- Hidden iframe at `/sandbox.html`
- MessagePort for bidirectional communication
- 5-second timeout; configurable max command count
- Returns `ExecutionTrace` with `commands[]` and final `PositionState`
- Reference: `src/lib/sandbox/SandboxExecutor.ts:58–106`

**Grading Pipeline**
- Route by type → simulate commands → compare against test cases
- Test case types: `target` / `commands` / `state` / `path` / `collect`
- Reference: `src/lib/graders/index.ts`

**Remote Functions Pattern**
- `query()` / `command()` wrappers with Zod schema validation
- Reference: `src/lib/remote/exercises.remote.ts`

---

## Chapter 5 — Implementation

### Key Challenges to Cover

**1. Blockly + Svelte 5 Integration** (`src/lib/components/BlocklyWorkspace.svelte`, 148 lines)
- Problem: Blockly needs direct DOM manipulation; Svelte 5 is declarative
- Solution: `$effect` rune for lifecycle management, `Blockly.inject()` in effect, cleanup on destroy
- Block prefixing: `${prefix}_${block.id}` in `BlocklyFactory.ts` to namespace custom blocks
- Reference: `src/lib/blockly/BlocklyFactory.ts:12–82`

**2. Canvas2D Inheritance Hierarchy** (`src/lib/canvas/`)
- `Canvas2D.svelte.ts` — base class: `state: PositionState`, `commands: Command[]`, `move()`, `turn()`
- `Turtle.svelte.ts` — extends Canvas2D: adds `pen`, `color`, `_path: PathSegment[]`
- `Robot.svelte.ts` — extends Canvas2D: grid-aware movement (cellSize-based)
- All expose an `api` object that becomes the sandbox's callable surface

**3. Sandboxed Execution** (`src/lib/sandbox/SandboxExecutor.ts`)
- Hidden iframe at `/sandbox.html`
- MessagePort for bidirectional communication
- 5-second timeout; configurable max command count
- Returns `ExecutionTrace` with `commands[]` and final `PositionState`

**4. Grading Pipeline** (`src/lib/graders/index.ts`, 499 lines)
- `gradeExercise()` routes by exercise type
- I/O: normalize text (trim, collapse whitespace, case, line endings, decimal sep), compare stdin→stdout
- Visual: simulate turtle/robot from `Command[]`, compare final state against test cases
- Score = `Math.round((passedTests / totalTests) * 100)`
- Tolerance-based comparison: Euclidean distance + shortest-arc angle diff (lines 123–132)

**5. Teacher CMS** (`src/routes/(app)/cms/`)
- Tab-based: Courses view, Exercises view
- Validation linter: checks published exercises for completeness before publishing
- Exercise versioning: `exerciseVersions` table stores snapshots

### Do NOT Claim
- ❌ No Playwright E2E tests (only Vitest in actual `package.json`)
- ❌ No Paraglide i18n (uses custom `translations` DB table with runtime lookup)
- ❌ No age-band or difficulty fields in DB schema

---

## Chapter 6 — Evaluation

### Recommended Approach: Heuristic Evaluation

More feasible than a pilot study for timeline constraints.

**Method**
1. Apply Nielsen's 10 usability heuristics to BlockQuiz
2. Evaluate student-facing exercise player AND teacher CMS separately
3. Document specific findings per heuristic with concrete examples
   - Example: "The exercise player scores well on 'Visibility of system status' because the run button changes state during execution"

**Grader Accuracy**
- Test known programs against the grader
- Cover: correct solutions, incorrect solutions, edge cases (off-by-one, tolerance boundary)

**If a pilot study is done:**
- Document participant count honestly
- Note limitations (small N, no control group, no longitudinal data)

**Citations:** `\cite{read2008}` for child-computer interaction evaluation criteria

---

## Chapter 7 — Conclusion

### Structure

**Summary**
- BlockQuiz addresses the gap between open-ended tools (Scratch) and US-centric cloud platforms (Code.org) for Austrian school deployments

**Contributions**
1. Constrained exercise model (discriminated union: io / turtle / robot)
2. Self-hostable architecture (Docker + SQLite, no external services)
3. Three-engine grader (I/O + turtle + robot)

**Limitations**
- Single school focus
- Small exercise library
- No longitudinal study
- Robot exercise engine is early-stage

**Future Work**
- Text-mode transition (block→text)
- LMS integration
- Analytics dashboard
- More exercise types

---

## Key Code References

| Topic | File | Lines |
|---|---|---|
| Exercise types discriminated union | `src/lib/types/exercise.ts` | 25–28, 192–210 |
| DB schema | `src/lib/server/db/schema.ts` | 7–173 |
| Grading logic | `src/lib/graders/index.ts` | 24–30, 123–132, 177–294 |
| Canvas2D base | `src/lib/canvas/Canvas2D.svelte.ts` | full file |
| Turtle engine | `src/lib/canvas/Turtle.svelte.ts` | full file |
| Robot engine | `src/lib/canvas/Robot.svelte.ts` | full file |
| Blockly factory | `src/lib/blockly/BlocklyFactory.ts` | 12–82 |
| Sandbox executor | `src/lib/sandbox/SandboxExecutor.ts` | 58–106 |
| Auth config | `src/lib/server/auth.ts` | full file |
| Remote functions pattern | `src/lib/remote/exercises.remote.ts` | — |
