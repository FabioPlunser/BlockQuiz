- Softwarequalitaet kritieren der software
- Wie erstellt man fragen, fragenpool, kategoriern, themen, kurse Designentscheidung 
- Wie validiert man? 
  - Hints
  - Pruefen von output und block zusammenhang
- Ausfuerhung 
- Welche Arten von Aufgaben 
  - Bloecke generieren code fuer eine API 
  - Wie kann man eine Softwarearchitektur bauen um die bloekce relativ einfach zu aendern was fuer einen code sie generieren Plugin feature 
  - Tools verbindungen wie kann man des Generisch machen 
  - 2 Beispiele
- LLMs

# Open questions: 
- Should the website be internationalized (i18n) so have multiple languages or are we set to do it in english or german? 
- Is a account management needed to keep track of user progress? Or do we just keep it in the localstorage of their browser? 
This changes the scope and makes the database a bit more complex but a basic login should be no problem. A login with UIBK SAML/SSO might be a bit trickier. (nice to have)

# Scope: 
Build a web-based, block-programming learning platform that is similar to https://brilliant.org interactive exercises for children. 
The platform should have auto-graded puzzles with constrained block toolboxes and immediate feedback. 
It replaces the original plan (physical coding blocks + blockly) with a fully virutal, browser-based experience. 
- Englisch and german language required

## Deliverables 
- MVP 
  - Left pane: problem statement, examples, hints and feedback 
  - Right pane: Code blocks
  - "RUN" and "CHECL" to execute code in a sandbox and auto-grade
- Two exercies types: 
    - I/O puzzles, produce expected text/number outputs from input 
    - Graphics puzzles, for example a turtle or a car moving 
  - Authoring pipeline: 
    - JSON/DB schmema for exercises (prompt, toolbox, tests, hints, solution)
    - Minimal authoring UI (CMS)
- 10 curated exercises across core CS concespt (loops, conditions, variables, simple function)

## Out of scope 
- Full user accounts and classroom management (Kahoot style)
- Complex simulator beyond turtle/2D canvas

# Target group: 
Primary Ages 8-12: 
- Cognitive fit for block logic, loops, conditionals, variables 
- Can handle short, structured puzzles and read consic instructions 
  
These is just my first guess and googeling a bit and asking AI. 
I think 8 is good starting point maybe depending on the puzzle even 6. I think under 6 years old it can get tricky with understanding the questions. 

# Similar Work:
- Scratch (MIT): Open-ended creative projects for ages ~8-15; 
  - https://scratch.mit.edu/research
- Code.org CS Fundamentals: 
  - https://code.org/en-US
  - https://code.org/files/HourOfCodeImpactStudy_Jan2017.pdf

- Microsoft MakeCode (Arcade, micro:bit): 
  Blok editors with built-in simulators; seamless block->Javascript/Python transitions 
  Either linked to a game like an Arcade or Minecraft modding or to hardware but simulators are build in for those presets. 
  - Minecraft Modding
  - https://www.microsoft.com/de-de/makecode
  - https://arcade.makecode.com/
  
- Tynker: 
  Playfull programming experience blocks are linked to a game
  - Minecraft Modding
  - https://www.tynker.com/
  - ![](https://www.tynker.com/image/parents/curriculum/computing-1/screenshots/screen-1-beatboxing-gnomes.png)

- Snap! (Berkeley): 
  Snap! is a broadly inviting programming language for kids and adults that's also a platform for serious study of computer science.
  - https://snap.berkeley.edu/
  - ![](https://snap.berkeley.edu/static/img/widewalls.png)

- MIT App Inventor: https://appinventor.mit.edu/
- Blockly (Google): Underlying library for the above services
  - https://developers.google.com/blockly?hl=de
  - https://de.wikipedia.org/wiki/Blockly
  
Difference vs. existing tools: 
- Focus on short, tightly constrained, auto-graded puzzles. 
Snap and tynker have a similar approach but it seems a bit bloated. 

- Österreich "Digitale Grundbildung" in Schulen: 
Seit 2022/23 pflichtfach Sekundarstufe I 
https://microbit.eeducation.at/images/c/c7/Buch_microbit_sek_i-Auflage_2022_20220905_30MB.pdf


# Goals: 
## Larning goals 
- Core CS concespt 
- Visual reasoning 
- Thinking 

## Product goals: 
- Clear easy to use UI for learner and creator 
- Constrained toolboxs per exercies to reduce cognitive load and guide solutoins 
- Reliable, safe, client-side execution and grading with timeouts
- Simple CMS 
- Accessibility: large hit targets, good focus order easy to understand UI 

Research/engineering goals 
- Research other learning platforms 
- Research exercises for this platform 
- Choice between Blockly and MakeCode 
- Define a question design framework (what defines a good question)
- Evaluate usability

# Technology: 
## Frontend: 
- Sveltekit for the app shell 
- Tailwind CSS for rapid, consistend stuling 


### Blockly vs Microsoft MakeCode

| Feature / Criteria                | Blockly (Google)                                                | Microsoft MakeCode                                             | Better for Quiz Platform |
|----------------------------------|-----------------------------------------------------------------|----------------------------------------------------------------|--------------------------|
| **What it is**                   | A library for building custom block editors (embed in your app) | A full platform built on Blockly + Monaco, with editors (Arcade, micro:bit, etc.) | Depends on scope |
| **Integration in custom site**   | Easy to embed in SvelteKit/Tailwind; full layout control        | Heavy; usually embed full editor; less control over layout      | **Blockly** |
| **Custom exercise flow**         | Full control (per-exercise toolbox, starter XML, hidden tests)  | Tutorials/projects format; custom graders harder                | **Blockly** |
| **Auto-grading**                 | Generate JS and run in your own sandbox; design any grader type | Built-in simulators only; arbitrary test logic is harder        | **Blockly** |
| **CMS/authoring integration**    | Flexible JSON/DB schema; easy to connect to CMS                 | Limited; must adapt to MakeCode project/tutorial models         | **Blockly** |
| **Simulators**                   | None by default; you can add turtle/graphics or custom          | Built-in (Arcade game engine, micro:bit simulator)              | MakeCode (if aligned) |
| **Block⇄text transition**        | Possible via code generators; you build the toggle UI           | Polished block⇄JavaScript/Python built-in                       | MakeCode |
| **Accessibility**                | Improving; you must configure ARIA, focus order, keyboard nav   | Strong defaults (keyboard nav, high contrast, classroom ready)  | MakeCode |
| **Security / sandboxing**        | You implement iframe sandbox & API; full control                | Sandboxed by default inside MakeCode environment                | Tie |
| **Analytics**                    | Easy to log attempts, time, block usage in your app             | Limited; telemetry tied to targets                              | **Blockly** |
| **Engineering effort**           | More setup (sandbox, graders, CMS), but flexible long-term      | Faster start if content matches targets; steep if customized    | Tie (depends on goals) |
| **Best use case**                | Bespoke quiz/exercise sites, CMS-driven, custom grading flows   | Predefined domains (games, microcontrollers, classroom lessons) | **Blockly** |

---

# Why Blockly is more suited
The core needs are:
- Left/right layout (instructions + blocks)
- Per-exercise constrained toolbox
- Auto-grading of outputs and turtle tasks
- Easy CMS/JSON-based question authoring
- Tight integration into a SvelteKit/Tailwind stack

**Blockly is better suited** because it is a *library* which can be shape to your exact UX and grading model.  
MakeCode is excellent for games and hardware with built-in simulators, but it is much harder to adapt for a quiz/CMS-driven flow.  


### Execution and sandbox:
- Generated JavaScript from Blockly runs in a sandboxed iframe (or SES) 
- Strict API surface 
- Infitine loop trap timeout 
- No direct access to window/document;

## Grading: 
- I/O tasks: normalize and compare outputs across multiple hidden/public tests 
- Turtle tasks: grade by command log, end pose, target-reaching, or pixel comparison with tolerances 
- Optional randomized tests with seeded RNG for robustness

## Storage 
- Static JSON files in repo with ho-reload previews 
- Or SQLIte via Drizzle ORM with a minimal admin UI 


## Analytics 
- Attempt count, time-on-task, blocks used, hint usage 
- Stored locallyt or in DB for evaluation study 

--- 

# AI Generated

# Framework for implementation

MVP sprints:
- Sprint 1: Core exercise page
  - Blockly workspace component with per-exercise toolbox and starter XML
  - Iframe sandbox with loop trap and timeout
  - I/O grader with multiple tests and feedback UI
- Sprint 2: Turtle exercise type
  - Canvas-based turtle API (move, turn, pen, color)
  - Command-log-based grader (reach target/draw shape)
  - Authoring JSON schema and loader
- Sprint 3: Authoring + evaluation
  - Minimal admin page or headless CMS integration
  - Hints system and per-test feedback
  - Pilot study instrumentation and data collection

Exercise JSON schema (draft):
- id, title, ageBand, concepts, prompt (rich text)
- toolbox: list of allowed block types
- starterXml: initial workspace
- grader:
  - type: "io" | "turtle" | "state"
  - tests: inputs/expected (io), targets/geometry (turtle)
  - normalization/tolerances
- hints: ordered list
- solutionRef: reference XML/JS
- difficulty, estimatedTime

Safety and accessibility:
- Iframe sandbox + strict API
- Big buttons, keyboard navigable controls, ARIA labels
- Keep toolbox small; progressive disclosure of blocks


# Framework for good questions

Principles:
- One concept per puzzle: isolate the learning target (e.g., “loops over a
  count,” “if-else for thresholds”).
- Constrained toolbox: include only blocks needed for the concept; avoid
  distractions.
- Worked examples then transfer: show a solved micro-example before a similar
  exercise to solve.
- Immediate feedback: clear pass/fail per test with minimal spoilers; show
  diffs for I/O or a visual overlay for turtle mistakes.
- Multiple test cases: generalize beyond the shown example; hide some tests.
- Progression: increase complexity gradually (more steps, nested logic,
  additional constraints).
- Productive failure: hints scaffold thinking (strategy, not the final answer).
- Visual goals: for turtle tasks, show targets, allowed moves, and boundaries.
- Age-appropriate language: short sentences, icons, and examples for 8–12.

Template (authoring checklist):
- Learning objective: what should the learner master?
- Prior knowledge: what do they need to already understand?
- Toolbox: minimal block set required to solve
- Starter XML: seed blocks that reduce setup friction
- Tests: 2–5 public + 2–5 hidden; cover edge cases
- Hints: 2–3 escalating hints from strategy to more concrete guidance
- Success criteria: explicit expected behavior
- Common misconceptions: pre-empt with hint wording or UI nudges

Example exercise outline (turtle, age 8–12):
- Objective: Use a loop to draw a square
- Toolbox: repeat, move, turn, number, penDown
- Starter: penDown already placed
- Tests: square of size 20 and 35; hidden test size 50
- Hints: (1) A square repeats the same steps 4 times; (2) Turn angle?

Example exercise outline (I/O, age 8–12):
- Objective: Sum numbers from 1 to N
- Toolbox: variables_set, math_arithmetic, controls_repeat_ext, text_print,
  math_number
- Tests: N = 3 → 6, N = 5 → 15; hidden: N = 1, N = 10
- Hints: (1) Use a loop and an accumulator; (2) Initialize total to 0


# References (starter list)

- Blockly (Google) documentation:
  - https://developers.google.com/blockly/
- Scratch (MIT):
  - https://scratch.mit.edu/
- Code.org CS Fundamentals:
  - https://code.org/educate/curriculum/elementary-school
- Microsoft MakeCode:
  - https://makecode.com/
- TurtleBlocksJS (Sugar Labs):
  - https://github.com/sugarlabs/turtleblocksjs
- TurtleGFX (JS):
  - https://github.com/CodeGuppyPrograms/TurtleGFX
- Background on physical blocks (original thesis context):
  - Project Bloks: https://research.google/blog/project-bloks-making-code-physical-for-kids/





