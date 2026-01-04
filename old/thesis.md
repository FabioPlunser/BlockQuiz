# Bachelor Thesis: BlocklyQuiz

## Thesis Metadata

**Title (German):**  
Entwurf und Implementierung einer webbasierten, blockbasierten Lernplattform mit automatisiertem Grading für Kinder von 6–12 Jahren

**Title (English):**  
Design and Implementation of a Web-Based Block Programming Learning Platform with Automated Grading for Children Ages 6–12

**Author:** [Your Name]  
**Supervisor:** [Supervisor Name]  
**University:** [University Name]  
**Degree:** Bachelor of Science in Computer Science  
**Submission Date:** February 2025  
**Word Count Target:** ~15,000 words (~45 pages)

---

## Abstract (1 page)

### German
Diese Bachelorarbeit präsentiert die Konzeption und Implementierung einer webbasierten Lernplattform für blockbasierte Programmierung, die sich an Kinder im Alter von 6–12 Jahren richtet. Im Gegensatz zu bestehenden Lösungen wie Scratch oder MakeCode liegt der Fokus auf kurzen, fokussierten Übungen mit automatischem Grading und einem Content-Management-System (CMS) für Lehrkräfte. Die Plattform unterstützt verschiedene Übungstypen (Turtle-Grafik, Roboter-Navigation) und bietet mehrsprachige Unterstützung (DE/EN). Ein besonderer Schwerpunkt liegt auf Datenschutz und einfacher Bereitstellung in Schulnetzwerken via Docker. Die Evaluation durch eine Pilotstudie mit 4–6 Kindern zeigt [Ergebnisse]. Die Arbeit diskutiert Architekturentscheidungen, pädagogische Designprinzipien und zukünftige Erweiterungsmöglichkeiten.

### English
This bachelor thesis presents the design and implementation of a web-based learning platform for block-based programming targeting children ages 6–12. Unlike existing solutions such as Scratch or MakeCode, the focus lies on short, focused exercises with automated grading and a Content Management System (CMS) for teachers. The platform supports multiple exercise types (turtle graphics, robot navigation) and provides multilingual support (DE/EN). Special emphasis is placed on privacy and easy deployment in school networks via Docker. Evaluation through a pilot study with 4–6 children shows [results]. The thesis discusses architectural decisions, pedagogical design principles, and future extension possibilities.

---

## Table of Contents

1. Introduction
2. Related Work
3. Requirements Analysis
4. System Design
5. Architecture
6. Pedagogical Design
7. Implementation
8. Evaluation
9. Discussion & Limitations
10. Conclusion & Future Work
11. References
12. Appendix

---

## Chapter 1: Introduction (5-6 pages)

### 1.1 Motivation and Context

**Topics to cover:**
- Digital education initiative in Austria ("Digitale Grundbildung" - mandatory since 2022/23)
- Importance of computational thinking for children
- Gap between available tools and classroom needs
- Need for teacher-friendly content creation tools

**Key points to argue:**
- Existing platforms (Scratch, MakeCode) are powerful but often too open-ended
- Teachers need guided, curriculum-aligned exercises they can customize
- Privacy concerns with cloud-based platforms in schools
- Auto-grading reduces teacher workload while providing immediate feedback

**Statistics/Sources to include:**
- Austrian curriculum requirements
- Studies on block-based programming effectiveness
- Teacher adoption barriers

### 1.2 Problem Statement

**The problem:**
- Existing block-based programming platforms lack:
  1. **Teacher CMS** - Easy exercise creation without programming knowledge
  2. **Curriculum alignment** - Short, focused exercises instead of open projects
  3. **Auto-grading** - Immediate feedback without teacher intervention
  4. **Privacy-first** - Self-hostable, GDPR-compliant, no cloud dependency
  5. **Age differentiation** - Content appropriate for different developmental stages (6-12)

### 1.3 Research Questions

1. **RQ1:** How can a block-based programming platform be designed to support teachers in creating age-appropriate exercises without programming knowledge?

2. **RQ2:** What architecture enables secure, sandboxed code execution with deterministic auto-grading?

3. **RQ3:** How can multiple exercise types (turtle graphics, grid navigation) be abstracted into a unified, extensible framework?

4. **RQ4:** How do children ages 6-12 interact with the platform, and what usability issues arise?

### 1.4 Contributions

This thesis contributes:
1. A **teacher-focused CMS** for block-based exercise creation
2. A **reactive state architecture** using Svelte 5 runes for exercise engines
3. A **sandbox execution model** with loop traps and API whitelisting
4. An **extensible exercise type framework** (Turtle, Grid Robot)
5. A **privacy-first deployment model** via Docker
6. A **pilot evaluation** with children ages 6-12

### 1.5 Thesis Structure

Brief overview of each chapter.

---

## Chapter 2: Related Work (8-10 pages)

### 2.1 Block-Based Programming Environments

**Platforms to analyze:**

| Platform | Strengths | Weaknesses | Our Differentiation |
|----------|-----------|------------|---------------------|
| **Scratch** (MIT) | Creative expression, community | Too open-ended, no grading | Focused exercises, auto-grading |
| **MakeCode** (Microsoft) | Hardware integration, polished | Complex, hardware-focused | Web-only, simpler |
| **Blockly** (Google) | Library, customizable | Just a library, no platform | We build the platform |
| **Code.org** | Curriculum, grading | Proprietary, US-focused | Open-source, EU/Austrian |
| **Snap!** (Berkeley) | Advanced features | Too complex for 6-8 | Age-appropriate |
| **Tynker** | Gamified, engaging | Commercial, cloud-only | Free, self-hostable |

**Key papers to cite:**
- Resnick et al. (2009) - Scratch: Programming for All
- Weintrop & Wilensky (2015) - Block vs. text programming
- Price & Barnes (2015) - Comparing block vs. flow representations

### 2.2 Auto-Grading in Programming Education

**Topics:**
- Approaches to automated assessment
- Immediate feedback benefits (Shute, 2008)
- Test-based vs. state-based grading
- Handling non-determinism

**Systems to compare:**
- Code.org's grading approach
- CodeRunner (Moodle plugin)
- Academic auto-graders (JavaBrat, Web-CAT)

### 2.3 Learning Theory Foundations

**Theories to discuss:**

1. **Constructionism** (Papert, 1980)
   - Learning by creating
   - Logo and turtle graphics history

2. **Cognitive Load Theory** (Sweller, 1988)
   - Why block-based reduces extraneous load
   - Scaffolding and worked examples

3. **Zone of Proximal Development** (Vygotsky)
   - Progressive hint systems
   - Age-appropriate challenges

4. **Immediate Feedback** (Hattie & Timperley, 2007)
   - Effects on learning
   - Auto-grading as feedback mechanism

### 2.4 Age-Appropriate Design (6-12 years)

**Developmental considerations:**
- Piaget's stages (concrete operational: 7-11)
- Attention span differences
- Reading level requirements
- Abstract vs. concrete thinking

**Design guidelines:**
- Large, colorful blocks
- Minimal text
- Visual feedback
- Forgiving interfaces

### 2.5 Privacy and Data Protection

**Topics:**
- GDPR requirements for children's data
- Privacy by Design principles
- Austrian school data protection guidelines
- On-premise vs. cloud deployment

---

## Chapter 3: Requirements Analysis (5-6 pages)

### 3.1 Stakeholders

| Stakeholder | Needs | Priorities |
|-------------|-------|------------|
| **Students (6-12)** | Fun, achievable challenges, immediate feedback | Usability, engagement |
| **Teachers** | Easy content creation, progress tracking | CMS, minimal setup |
| **School IT** | Easy deployment, maintenance | Docker, privacy |
| **Parents** | Safe, educational, privacy | No tracking, GDPR |

### 3.2 Use Cases

**UC1: Teacher Creates Exercise**
1. Teacher opens CMS
2. Selects exercise type (Turtle/Robot)
3. Writes title/description (DE/EN)
4. Draws target path/grid layout
5. Selects allowed blocks
6. Adds hints
7. Tests solution
8. Publishes to course

**UC2: Student Solves Exercise**
1. Student opens course
2. Sees exercise description
3. Drags blocks to create program
4. Clicks "Run" to test
5. Clicks "Check" to grade
6. Views result (pass/hints/retry)
7. Moves to next exercise

**UC3: School IT Deploys Platform**
1. Installs Docker
2. Runs `docker-compose up`
3. Creates admin account
4. Teachers create content
5. Students access via browser

### 3.3 Functional Requirements

**FR1: Exercise Management**
- FR1.1: Multiple exercise types (Turtle, Robot, I/O)
- FR1.2: Multilingual content (DE/EN)
- FR1.3: Age-band tagging (6-8, 8-10, 10-12)
- FR1.4: Progressive hints system

**FR2: Exercise Execution**
- FR2.1: Blockly workspace with customizable toolbox
- FR2.2: Code generation from blocks
- FR2.3: Sandboxed execution
- FR2.4: Infinite loop protection

**FR3: Auto-Grading**
- FR3.1: State-based grading (position, angle)
- FR3.2: Command sequence matching
- FR3.3: Partial credit scoring
- FR3.4: Immediate feedback

**FR4: Course Management**
- FR4.1: Group exercises into courses
- FR4.2: Sequential/random ordering
- FR4.3: Assign to classes/age groups
- FR4.4: Progress tracking

**FR5: User Management**
- FR5.1: Teacher/Student/Admin roles
- FR5.2: Class grouping
- FR5.3: Guest mode (no account required)
- FR5.4: Progress persistence

### 3.4 Non-Functional Requirements

**NFR1: Security**
- Sandboxed code execution
- No student code access to DOM/network
- CSP headers
- Input validation

**NFR2: Privacy**
- GDPR compliance
- Local deployment option
- Minimal data collection
- No third-party services

**NFR3: Performance**
- Page load < 2s
- Code execution < 2s
- Responsive on tablets

**NFR4: Usability**
- Age-appropriate UI
- Keyboard accessible
- Screenreader support

**NFR5: Maintainability**
- Modular architecture
- TypeScript strict mode
- Documented APIs

---

## Chapter 4: System Design (8-10 pages)

### 4.1 Design Decisions

#### Decision 1: Blockly vs. Custom Block Editor

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Google Blockly | Mature, documented, accessible | Large bundle size | ✅ Chosen |
| Custom implementation | Full control, smaller | Development time | ❌ |
| Scratch Blocks | Scratch-like feel | Less flexible | ❌ |

**Rationale:** Blockly provides excellent documentation, accessibility features, and proven reliability. The bundle size trade-off is acceptable.

#### Decision 2: Client-Side vs. Server-Side Execution

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Client-side (iframe sandbox) | No server load, immediate | Limited isolation | ✅ Chosen |
| Server-side (VM/container) | Better isolation | Complexity, latency | ❌ |
| WebAssembly sandbox | Best isolation | Development time | Future work |

**Rationale:** For educational code from children, client-side execution with loop traps is sufficient. Server-side would add complexity without proportional benefit.

#### Decision 3: Database Choice

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| SQLite | No setup, portable, embedded | Single-writer | ✅ Chosen |
| PostgreSQL | Scalable, concurrent | Requires server | Future (SaaS) |
| JSON files | Simplest | No queries, no relations | ❌ |

**Rationale:** SQLite with Drizzle ORM provides the best balance for single-school deployments. Easy to upgrade to Postgres later.

#### Decision 4: State Management Architecture

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Svelte 5 runes ($state) | Native, reactive, simple | New paradigm | ✅ Chosen |
| Svelte stores | Established | Verbose for complex state | ❌ |
| External (Redux, Zustand) | Feature-rich | Extra dependency | ❌ |

**Rationale:** Svelte 5 runes in `.svelte.ts` files enable reactive classes that work seamlessly with components.

### 4.2 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (SvelteKit)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Teacher CMS │  │ Student UI  │  │ Admin Panel │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Blockly Workspace                       │    │
│  │  (Custom blocks, per-exercise toolbox)               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Exercise Engines (Canvas2D)                │    │
│  │  ┌─────────┐  ┌───────────┐  ┌────────┐             │    │
│  │  │ Turtle  │  │ GridRobot │  │ I/O    │             │    │
│  │  └─────────┘  └───────────┘  └────────┘             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sandbox (iframe)                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Generated JavaScript + Loop Trap + API Whitelist    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Grader                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Turtle    │  │    Robot    │  │     I/O     │          │
│  │   Grader    │  │   Grader    │  │   Grader    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (SvelteKit)                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Server Actions / Remote Functions                   │    │
│  │  (Type-safe, Zod validation)                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  SQLite + Drizzle ORM                                │    │
│  │  (Exercises, Courses, Users, Attempts)               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Exercise Type Framework

**Abstract Base: Canvas2D**
```typescript
class Canvas2D {
  // Reactive state
  x = $state(0);
  y = $state(0);
  commands = $state<Command[]>([]);
  
  // Abstract methods for grading
  get state(): EngineState;
  reset(): void;
  compareTo(target: EngineState): ComparisonResult;
}
```

**Concrete Implementation: Turtle**
```typescript
class Turtle extends Canvas2D {
  angle = $state(0);
  penDown = $state(true);
  
  move(distance: number): void;
  turn(degrees: number): void;
}
```

**Concrete Implementation: GridRobot**
```typescript
class GridRobot extends Canvas2D {
  cellX = $state(0);
  cellY = $state(0);
  inventory = $state<Item[]>([]);
  
  moveUp(): void;
  moveDown(): void;
  collect(): void;
  eat(): void;
}
```

### 4.4 Teacher CMS Design

**Exercise Editor Workflow:**
1. Select type → Loads appropriate canvas component
2. Configure metadata → Title, description, age range
3. Draw target → Visual path/grid editor
4. Select blocks → Toolbox builder
5. Write hints → Progressive hint editor
6. Test solution → Build with Blockly, run, verify grading
7. Publish → Make available to students

**Key Differentiator:**  
Teachers draw the target visually (click to add path points, place walls/items) rather than writing JSON configurations.

### 4.5 Security Model

**Threat Model:**
- Malicious student code (infinite loops, DOM access)
- XSS through user content
- Unauthorized data access

**Mitigations:**
1. **Iframe sandbox** - `sandbox="allow-scripts"`
2. **Loop trap** - Command counter injected into code
3. **API whitelist** - Only exercise-specific functions available
4. **CSP headers** - Strict content security policy
5. **Input validation** - Zod schemas on all inputs
6. **Role-based access** - Teachers can't access admin functions

---

## Chapter 5: Architecture (10-12 pages)

### 5.1 Frontend Architecture

**Technology Stack:**
- SvelteKit 2 (framework)
- Svelte 5 (UI library with runes)
- Tailwind CSS + DaisyUI (styling)
- Google Blockly (block editor)

**Component Hierarchy:**
```
App
├── Layout
│   ├── Header (navigation, user info)
│   └── Content
│       ├── CMS (teacher)
│       │   ├── CourseEditor
│       │   └── ExerciseEditor
│       │       ├── MetadataForm
│       │       ├── CanvasEditor (Turtle/Robot)
│       │       ├── ToolboxBuilder
│       │       ├── HintEditor
│       │       └── SolutionBuilder
│       └── Student
│           ├── CourseBrowser
│           └── ExercisePlayer
│               ├── BlocklyWorkspace
│               ├── Canvas (Turtle/Robot)
│               ├── Controls (Run/Check)
│               └── ResultDisplay
```

### 5.2 Reactive State with Svelte 5 Runes

**Why `.svelte.ts` files:**
```typescript
// src/lib/canvas/Turtle.svelte.ts

// $state works outside .svelte components!
export class Turtle {
  x = $state(200);  // Reactive!
  y = $state(200);  // Reactive!
  
  move(dist: number) {
    this.x += dist * Math.sin(this.angle);
    this.y -= dist * Math.cos(this.angle);
    // UI automatically updates!
  }
}
```

**Benefits:**
1. Logic separated from UI
2. Testable without components
3. Reactive updates "just work"
4. TypeScript class patterns

### 5.3 Sandbox Execution

**Execution Flow:**
```
1. Blockly workspace → XML
2. XML → JavaScript code (Blockly generator)
3. Code → Instrumented code (loop trap injection)
4. Instrumented code → iframe sandbox
5. Sandbox → postMessage results
6. Results → Grader
7. Grader → UI feedback
```

**Loop Trap Implementation:**
```typescript
function injectLoopTrap(code: string, max: number): string {
  // Insert counter at loop heads
  return code.replace(
    /for\s*\(/g, 
    `for (let __c=0; __c<${max}; __c++, `
  );
}
```

**API Whitelist:**
```typescript
const sandboxAPI = {
  turtle: {
    move: (d) => engine.move(d),
    turn: (d) => engine.turn(d),
    // Only whitelisted methods
  },
  // No: window, document, fetch, localStorage
};
```

### 5.4 Grading System

**Grading Strategies:**

1. **State-based** (position, angle, inventory)
   ```typescript
   function gradeState(actual: State, expected: State): boolean {
     return Math.abs(actual.x - expected.x) < tolerance &&
            Math.abs(actual.y - expected.y) < tolerance;
   }
   ```

2. **Command sequence** (exact steps)
   ```typescript
   function gradeCommands(actual: Command[], expected: Command[]): boolean {
     return JSON.stringify(actual) === JSON.stringify(expected);
   }
   ```

3. **Path comparison** (shape drawn)
   ```typescript
   function gradePath(actual: Point[], expected: Point[]): number {
     // Compare point-by-point with tolerance
   }
   ```

### 5.5 Database Schema

**ER Diagram:**
```
┌──────────┐     ┌──────────────┐     ┌──────────┐
│  Users   │────<│ Enrollments  │>────│ Classes  │
└──────────┘     └──────────────┘     └──────────┘
     │                                      │
     │                                      │
     ▼                                      ▼
┌──────────┐     ┌──────────────┐     ┌──────────┐
│ Attempts │>────│  Exercises   │────<│ Courses  │
└──────────┘     └──────────────┘     └──────────┘
```

### 5.6 API Design (Remote Functions)

**Pattern:**
```typescript
// src/lib/remote/exercises.remote.ts
export const exerciseRemote = {
  list: async () => {
    const res = await fetch('/api/exercises');
    return exerciseSchema.array().parse(await res.json());
  },
  
  create: async (data: ExerciseInput) => {
    const validated = exerciseInputSchema.parse(data);
    const res = await fetch('/api/exercises', {
      method: 'POST',
      body: JSON.stringify(validated)
    });
    return exerciseSchema.parse(await res.json());
  }
};
```

---

## Chapter 6: Pedagogical Design (5-6 pages)

### 6.1 Exercise Design Principles

1. **One Concept Per Exercise**
   - Single learning goal
   - Minimal cognitive load
   - Clear success criteria

2. **Progressive Difficulty**
   - Sequence within age band
   - Build on prior exercises
   - Gradual complexity increase

3. **Immediate Feedback**
   - Visual results (turtle moves)
   - Clear pass/fail indication
   - Helpful error messages

4. **Scaffolded Support**
   - Progressive hints (strategy → specific)
   - Starter blocks when helpful
   - Worked examples

### 6.2 Age-Appropriate Design

| Age | Characteristics | Design Implications |
|-----|-----------------|---------------------|
| 6-8 | Concrete thinking, limited reading | Large blocks, minimal text, simple sequences |
| 8-10 | Basic abstraction, longer attention | Loops, simple conditions, short descriptions |
| 10-12 | Abstract reasoning developing | Variables, nested logic, text-based options |

### 6.3 Example Exercise Designs

**Example 1: "Draw a Square" (Age 7-8)**
```
Learning Goal: Using loops for repetition
Concepts: repeat block, sequence
Toolbox: move, turn, repeat
Target: Square with side length 100
Hints:
  1. "Ein Quadrat hat 4 gleiche Seiten"
  2. "Wiederhole 4 mal: bewegen und drehen"
  3. "Drehe 90 Grad nach rechts"
```

**Example 2: "Hungry Robot" (Age 8-10)**
```
Learning Goal: Using conditionals
Concepts: if block, sensors
Toolbox: move_up/down/left/right, if, has_food_ahead, eat
Target: Robot eats pear, becomes happy
Grid: 5x5, robot at (0,0), pear at (3,2)
Hints:
  1. "Der Roboter muss zur Birne gelangen"
  2. "Wenn du dort bist, iss die Birne"
  3. "3× rechts, 2× runter, dann essen"
```

### 6.4 Hint System Design

**Progressive Disclosure:**
- Hint 1: Strategy-level (what approach)
- Hint 2: Structure-level (what blocks)
- Hint 3: Near-solution (specific steps)

**Tracking:**
- Record which hints were viewed
- Use in analytics
- Consider in scoring (optional penalty)

---

## Chapter 7: Implementation (8-10 pages)

### 7.1 Development Environment

- Runtime: Bun
- Framework: SvelteKit 2
- Language: TypeScript (strict)
- Database: SQLite + Drizzle
- Testing: Vitest + Playwright

### 7.2 Key Implementation Challenges

#### Challenge 1: Blockly Integration with Svelte 5

**Problem:** Blockly expects direct DOM manipulation; Svelte 5 is reactive.

**Solution:** Use `$effect` for lifecycle, export functions for imperative access.
```svelte
<script>
  let workspace: Blockly.Workspace;
  
  $effect(() => {
    workspace = Blockly.inject(div, config);
    return () => workspace.dispose();
  });
  
  export function getCode() {
    return generator.workspaceToCode(workspace);
  }
</script>
```

#### Challenge 2: Reactive Canvas Updates

**Problem:** Canvas needs to redraw when state changes.

**Solution:** Svelte 5 `$effect` triggers on state access.
```typescript
$effect(() => {
  // Accesses reactive properties
  const pos = { x: turtle.x, y: turtle.y };
  redrawCanvas();
});
```

#### Challenge 3: Sandboxed Execution

**Problem:** Student code must not access DOM/network.

**Solution:** iframe + restricted API object.
```typescript
const sandbox = document.createElement('iframe');
sandbox.sandbox.add('allow-scripts');

// Only expose safe functions
const api = { move: engine.move.bind(engine) };
sandbox.contentWindow.postMessage({ code, api });
```

#### Challenge 4: Loop Trap Without AST Parsing

**Problem:** Need to detect infinite loops without full parsing.

**Solution:** Regex-based injection + command counter.
```typescript
let commandCount = 0;
const MAX_COMMANDS = 10000;

function checkLimit() {
  if (++commandCount > MAX_COMMANDS) {
    throw new Error('Too many commands');
  }
}

// Inject into every function call
code = code.replace(/(\w+)\(/g, '(checkLimit(),$1(');
```

### 7.3 Code Examples

**Exercise Engine (Turtle):**
```typescript
export class Turtle extends Canvas2D {
  angle = $state(0);
  penDown = $state(true);
  
  move(distance: number) {
    const rad = this.angle * Math.PI / 180;
    this.x += distance * Math.sin(rad);
    this.y -= distance * Math.cos(rad);
    this.record('move', distance);
  }
}
```

**Grader:**
```typescript
export function gradeTurtle(
  engine: Turtle,
  test: TurtleTest
): GradeResult {
  const state = engine.state;
  const expected = test.expected;
  
  const passed = 
    Math.abs(state.x - expected.x) < test.tolerance &&
    Math.abs(state.y - expected.y) < test.tolerance;
    
  return { passed, score: passed ? 1 : 0 };
}
```

### 7.4 Testing Strategy

**Unit Tests:**
- Engine methods (move, turn calculations)
- Grader logic (state comparison)
- Loop trap detection

**Integration Tests:**
- Blockly → Code generation → Execution → Grading
- Exercise CRUD operations
- User authentication flows

**E2E Tests (Playwright):**
- Teacher creates and publishes exercise
- Student completes exercise
- Progress is persisted

---

## Chapter 8: Evaluation (5-6 pages)

### 8.1 Evaluation Goals

1. **Usability:** Can children 6-12 use the platform effectively?
2. **Learning:** Do exercises teach intended concepts?
3. **Teacher Experience:** Can teachers create exercises without help?

### 8.2 Methodology

**Pilot Study Design:**
- Participants: 4-6 children (ages 6-12, mixed)
- Method: Think-aloud protocol
- Duration: 30-45 minutes per session
- Exercises: 3-5 turtle + 2-3 robot exercises

**Data Collection:**
- Screen recording (with consent)
- Observer notes
- Time per exercise
- Attempts and hints used
- Post-session interview

### 8.3 Metrics

| Metric | Measurement | Target |
|--------|-------------|--------|
| Completion rate | % exercises passed | > 70% |
| Time on task | Minutes per exercise | < 10 min |
| Hint usage | Average hints per exercise | < 2 |
| Error rate | Failed attempts before success | < 5 |
| Satisfaction | 5-point scale ("Was it fun?") | > 4 |

### 8.4 Results

[To be filled after pilot study]

**Quantitative:**
- Completion rates by exercise and age group
- Time distributions
- Hint usage patterns

**Qualitative:**
- Common difficulties observed
- UI confusion points
- Positive feedback themes

### 8.5 Analysis

[To be filled after pilot study]

- Success factors
- Problem areas
- Age-group differences

---

## Chapter 9: Discussion & Limitations (4-5 pages)

### 9.1 Discussion of Results

- How well did the platform meet requirements?
- Which design decisions proved correct?
- What would be done differently?

### 9.2 Comparison to Research Questions

**RQ1 (Teacher CMS):**  
- Visual path drawing enables non-programmers to create exercises
- Toolbox builder simplifies block selection
- Preview mode allows testing before publishing

**RQ2 (Secure Sandbox):**  
- iframe + loop trap prevents harmful code
- API whitelist restricts available functions
- Deterministic grading achieved via seeded RNG

**RQ3 (Extensible Framework):**  
- Canvas2D base class enables new exercise types
- Grader interface allows custom grading logic
- Blockly integration is modular

**RQ4 (Usability):**  
- [Results from pilot study]

### 9.3 Limitations

1. **Small Sample Size**
   - 4-6 children not statistically significant
   - No control group
   - Results are indicative, not conclusive

2. **Limited Exercise Types**
   - Only Turtle and Robot implemented
   - I/O type mentioned but not fully implemented
   - LLM integration as future work

3. **Single-School Focus**
   - Architecture optimized for single deployment
   - Multi-tenant SaaS would require changes
   - No SSO integration

4. **No Long-Term Study**
   - Single session per child
   - Learning retention not measured
   - Engagement over time unknown

### 9.4 Threats to Validity

**Internal:**
- Observer effect (children behave differently when watched)
- Selection bias (volunteer participants)
- Exercise ordering effects

**External:**
- Small, non-random sample
- Single geographic location
- Short interaction time

---

## Chapter 10: Conclusion & Future Work (3-4 pages)

### 10.1 Summary

This thesis presented BlocklyQuiz, a block-based programming platform designed for children ages 6-12. Key contributions include:

1. **Teacher-focused CMS** with visual exercise creation
2. **Reactive state architecture** using Svelte 5 runes
3. **Secure sandbox execution** with loop traps
4. **Extensible exercise framework** (Turtle, Robot)
5. **Privacy-first deployment** via Docker

The pilot evaluation demonstrated [key findings].

### 10.2 Future Work

**Short-term (6 months):**
- Additional exercise types (I/O, pixel art)
- LLM-powered hint generation
- Class management features
- Mobile optimization

**Medium-term (1-2 years):**
- Visual block builder for teachers
- Multi-tenant SaaS deployment
- SSO integration (SAML, OIDC)
- Analytics dashboard

**Long-term (research):**
- Longitudinal learning studies
- Adaptive difficulty algorithms
- AI-generated exercises
- 3D exercise types

### 10.3 Closing Remarks

BlocklyQuiz addresses a real need in Austrian schools for curriculum-aligned, teacher-friendly programming education tools. By focusing on simplicity, privacy, and extensibility, the platform provides a foundation for future development while being immediately useful in classroom settings.

---

## References

[Bibliography in appropriate format - IEEE/ACM]

Key references to include:
- Resnick et al. (2009) - Scratch
- Papert (1980) - Mindstorms
- Sweller (1988) - Cognitive Load Theory
- Blockly documentation
- Austrian Digitale Grundbildung curriculum
- GDPR/DSGVO documentation
- Svelte/SvelteKit documentation

---

## Appendix

### A. Exercise JSON Schema

```json
{
  "$schema": "...",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "type": { "enum": ["turtle", "robot", "io"] },
    "title": {
      "type": "object",
      "properties": {
        "de": { "type": "string" },
        "en": { "type": "string" }
      }
    },
    // ... full schema
  }
}
```

### B. Example Exercise (Complete JSON)

```json
{
  "id": "turtle-square-1",
  "type": "turtle",
  "title": { "de": "Zeichne ein Quadrat", "en": "Draw a Square" },
  // ... complete example
}
```

### C. Pilot Study Protocol

1. Introduction script
2. Consent form template
3. Observer checklist
4. Interview questions

### D. Code Listings

Selected code examples:
- Turtle class implementation
- Grader algorithm
- Sandbox executor
- Loop trap injection

### E. Screenshots

- Exercise Editor interface
- Student exercise view
- Course browser
- Results display

