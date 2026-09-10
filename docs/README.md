# BlockQuiz Implementation Documentation

This folder is the reference companion to the BlockQuiz codebase: a
SvelteKit + Bun web app for block-based programming exercises (8–12 year olds)
with a teacher CMS, sandboxed execution, autograding, and optional
self-hosting. The docs are written as if the reader will use them to write the
implementation section of a bachelor thesis — so each topic explains *what*
the system does, *how* the code is shaped, and *why* the design ended up that
way.

## Map of the documents

| Topic | File | Reads-like-a-thesis-chapter on… |
| --- | --- | --- |
| System architecture | [architecture.md](./architecture.md) | the stack, request lifecycle, package layout, and runtime topology |
| Exercise content model | [exercises-and-content.md](./exercises-and-content.md) | how courses/exercises/test cases are modeled, canonicalized, validated, versioned |
| Sandbox & grading | [sandbox-and-grading.md](./sandbox-and-grading.md) | the two-tier (client iframe + server worker) execution + grading pipeline |
| Canvas engines | [canvas-engines.md](./canvas-engines.md) | Turtle/Robot engines, collisions, pathfinding, the BlocklyFactory abstraction |
| Attempts, progress & analytics | [progress-attempts-analytics.md](./progress-attempts-analytics.md) | authenticated vs guest progress, badges (SDT-grounded), course analytics, pseudonymous research export |
| i18n & theming | [i18n-and-theming.md](./i18n-and-theming.md) | cookie-driven locale, FOUC-free theme, code-readout localization |
| Auth, roles & security | [auth-and-security.md](./auth-and-security.md) | Better Auth + SSO/JIT, role gates, audit log, CSP, request hooks |
| Topic-specific (operations) | [access-policy.md](./access-policy.md), [database.md](./database.md), [import-export.md](./import-export.md), [sso-and-email.md](./sso-and-email.md) | route policy, DB setup, transfer envelopes, SSO/email setup |

## Reading order suggestion

For a thesis chapter that goes *top-down*:

1. `architecture.md` — establishes the mental model
2. `exercises-and-content.md` — defines the domain
3. `sandbox-and-grading.md` and `canvas-engines.md` — the execution + grading
   subsystem, which is the technical heart of the system
4. `progress-attempts-analytics.md` — what learners and teachers see derived
   from attempts
5. `auth-and-security.md` and `i18n-and-theming.md` — the cross-cutting
   concerns
6. The four pre-existing operational docs as appendices

## Conventions used in the docs

- Code references use `path:line` so they can be opened directly from an IDE.
- Mermaid diagrams use `flowchart` and `sequenceDiagram` only; both render in
  GitHub-flavored Markdown and in most thesis-LaTeX pipelines via
  `mermaid-cli`.
- "Quirk" is a deliberate label: it marks decisions that look surprising in
  isolation but exist because of a specific constraint (kid-friendly UX,
  classroom deployment, browser sandbox semantics, SQLite + Bun
  interaction, etc.).
- Terms: a *learner* is the end user solving exercises; an *author* is a
  teacher/admin building them; a *guest* is an unauthenticated learner using
  `/demo`.
