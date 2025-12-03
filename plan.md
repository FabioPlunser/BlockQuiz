# BlocklyQuiz - Complete Implementation Plan

## 🎯 Project Vision

A **block-based learning platform** for children ages 6-12 that differentiates from MakeCode/Scratch through:
- **Teacher-focused CMS** - Non-programmers can create/customize exercises
- **Auto-grading** - Immediate feedback without teacher intervention  
- **Privacy-first** - Self-hostable via Docker, no cloud dependency
- **Curriculum-aligned** - Supports Austrian "Digitale Grundbildung"

---

## 📐 Architecture Overview

### Tech Stack
- **Frontend**: SvelteKit 2 + Svelte 5 (runes, `$state`, `$effect`)
- **Styling**: Tailwind CSS + DaisyUI
- **Block Editor**: Google Blockly
- **Database**: SQLite + Drizzle ORM (portable, no server needed)
- **Auth**: Lucia (simple, self-contained)
- **Deployment**: Docker Compose

### Key Architecture Decisions

#### 1. Reactive State Classes (`.svelte.ts` files)
```
src/lib/canvas/
├── Canvas2D.svelte.ts      # Base class with reactive $state
├── Turtle.svelte.ts        # Turtle graphics implementation
├── GridRobot.svelte.ts     # Grid-based robot navigation
└── types.ts                # Shared TypeScript types
```

**Why:** Svelte 5 runes (`$state`, `$derived`) work in `.svelte.ts` files, enabling:
- Testable logic without UI
- Reactive state that auto-updates components
- Clean separation of concerns

#### 2. Remote Functions Pattern
```
src/lib/remote/
├── exercises.remote.ts     # Exercise CRUD
├── courses.remote.ts       # Course management
├── attempts.remote.ts      # Student progress
└── schemas/                # Zod validation schemas
```

**Why:** Type-safe API calls with:
- Server-side validation
- Automatic error handling
- Works with SvelteKit form actions

#### 3. Sandbox Execution
```
src/lib/sandbox/
├── executor.ts             # Code execution in iframe
├── loop-trap.ts            # Infinite loop detection
└── api-whitelist.ts        # Restricted API surface
```

**Why:** Student code must be isolated:
- No DOM/window access
- No network requests
- Timeout protection
- Command counting

---

## 📋 Exercise Types

### Type 1: Turtle Graphics ✅ (In Progress)
**Concepts:** Sequences, loops, angles, coordinates
**Ages:** 6-12 (adjustable complexity)

| Exercise | Age | Concepts | Description |
|----------|-----|----------|-------------|
| Draw a Line | 6-7 | Sequence | Move turtle forward |
| Draw a Square | 7-8 | Loop | Repeat 4x: move + turn 90° |
| Draw a Triangle | 8-9 | Loop + Math | Repeat 3x: move + turn 120° |
| Draw a Star | 9-10 | Loop + Math | Repeat 5x: move + turn 144° |
| Spiral | 10-12 | Loop + Variable | Increasing move distance |
| House | 10-12 | Functions | Combine square + triangle |

### Type 2: Grid Robot 🤖 (To Implement)
**Concepts:** Sequences, loops, conditionals
**Ages:** 6-10 (simpler than turtle - no angles)

| Exercise | Age | Concepts | Description |
|----------|-----|----------|-------------|
| Reach the Goal | 6-7 | Sequence | Navigate 3-4 moves to star |
| Collect Coins | 7-8 | Sequence | Pick up items on path |
| Maze Runner | 8-9 | Loop | Repeat until at goal |
| Hungry Robot | 8-10 | Conditional | IF food nearby THEN eat |
| Wall Avoider | 9-10 | Conditional | IF wall ahead THEN turn |
| Smart Collector | 10-12 | Loop + Conditional | Collect all, avoid walls |

### Type 3: I/O Text (Optional)
**Concepts:** Variables, math, logic
**Ages:** 10-12

| Exercise | Age | Concepts | Description |
|----------|-----|----------|-------------|
| Double It | 10-11 | Variable | Input N, output N*2 |
| Sum 1 to N | 11-12 | Loop + Accumulator | Calculate sum |
| Even or Odd | 11-12 | Conditional | Check divisibility |

---

## 🗂️ Database Schema

### Core Tables

```sql
-- Users (teachers, students, admins)
users (
  id, email, password_hash, role, 
  class_id?, age?, language,
  created_at, updated_at
)

-- Courses (collection of exercises)
courses (
  id, title_de, title_en, description_de, description_en,
  age_min, age_max, difficulty, published,
  author_id, created_at, updated_at
)

-- Exercises
exercises (
  id, course_id, order_index,
  type ('turtle' | 'robot' | 'io'),
  title_de, title_en,
  description_de, description_en,
  toolbox JSON,           -- Allowed blocks
  starter_xml TEXT,       -- Initial workspace
  grader_config JSON,     -- Tests, targets, tolerances
  hints JSON,             -- Progressive hints [{de, en}]
  solution_xml TEXT,      -- Reference solution
  age_min, age_max, difficulty,
  created_at, updated_at
)

-- Exercise Translations (for future LLM integration)
exercise_translations (
  id, exercise_id, language, field, value,
  is_auto_generated, created_at
)

-- Student Attempts
attempts (
  id, user_id, exercise_id,
  workspace_xml TEXT,     -- Student's blocks
  result JSON,            -- Grading result
  hints_used INTEGER,
  time_spent INTEGER,     -- Seconds
  passed BOOLEAN,
  created_at
)

-- Classes (for school deployments)
classes (
  id, name, teacher_id, 
  join_code, created_at
)

-- Course Assignments
course_assignments (
  id, course_id, 
  class_id?, user_id?,    -- Assign to class OR individual
  due_date?, created_at
)
```

---

## 📁 File Structure

```
src/
├── lib/
│   ├── canvas/                      # Exercise engines
│   │   ├── Canvas2D.svelte.ts       # Base reactive class
│   │   ├── Turtle.svelte.ts         # Turtle implementation
│   │   ├── GridRobot.svelte.ts      # Robot implementation
│   │   └── types.ts
│   │
│   ├── blockly/                     # Block definitions
│   │   ├── turtleBlocks.ts          # Turtle block definitions
│   │   ├── robotBlocks.ts           # Robot block definitions
│   │   └── commonBlocks.ts          # Shared (loops, math, etc)
│   │
│   ├── graders/                     # Auto-grading logic
│   │   ├── turtle.ts
│   │   ├── robot.ts
│   │   └── io.ts
│   │
│   ├── sandbox/                     # Secure code execution
│   │   ├── executor.ts
│   │   ├── loop-trap.ts
│   │   └── restricted-api.ts
│   │
│   ├── remote/                      # Server communication
│   │   ├── exercises.remote.ts
│   │   ├── courses.remote.ts
│   │   ├── attempts.remote.ts
│   │   └── schemas/
│   │
│   ├── components/
│   │   ├── BlocklyWorkspace.svelte
│   │   ├── TurtleCanvas.svelte
│   │   ├── GridCanvas.svelte
│   │   ├── ExerciseEditor.svelte    # Teacher: create/edit
│   │   ├── ExercisePlayer.svelte    # Student: play
│   │   ├── CourseEditor.svelte
│   │   ├── HintRevealer.svelte
│   │   └── ResultDisplay.svelte
│   │
│   └── server/
│       ├── db/
│       │   ├── schema.ts            # Drizzle schema
│       │   └── client.ts
│       └── auth.ts                  # Lucia setup
│
├── routes/
│   ├── (app)/
│   │   ├── cms/                     # Teacher CMS
│   │   │   ├── +page.svelte         # Dashboard
│   │   │   ├── courses/
│   │   │   │   ├── +page.svelte     # Course list
│   │   │   │   ├── new/+page.svelte
│   │   │   │   └── [id]/+page.svelte
│   │   │   └── exercises/
│   │   │       ├── +page.svelte     # Exercise list
│   │   │       ├── new/+page.svelte
│   │   │       └── [id]/+page.svelte
│   │   │
│   │   ├── courses/                 # Student view
│   │   │   ├── +page.svelte         # Available courses
│   │   │   └── [courseId]/
│   │   │       ├── +page.svelte     # Course overview
│   │   │       └── [exerciseId]/
│   │   │           └── +page.svelte # Play exercise
│   │   │
│   │   ├── progress/                # Student progress
│   │   │   └── +page.svelte
│   │   │
│   │   └── admin/                   # Admin panel
│   │       ├── users/
│   │       └── classes/
│   │
│   ├── auth/
│   │   ├── login/
│   │   ├── register/
│   │   └── logout/
│   │
│   └── demo/                        # Public demo
│       └── +page.svelte
│
└── scripts/
    ├── seed-exercises.ts            # Example content
    └── migrate.ts
```

---

## 🚀 Implementation Phases

### Phase 1: Core Engine (Week 1) ✅ In Progress

#### 1.1 Fix Current Bugs
- [x] BlocklyWorkspace toolbox configuration
- [x] Turtle code generation (empty values)
- [ ] TurtleCanvas NaN handling
- [ ] Grader typos and logic

#### 1.2 Canvas2D Base Class
```typescript
// src/lib/canvas/Canvas2D.svelte.ts
export class Canvas2D {
  x = $state(0);
  y = $state(0);
  angle = $state(0);
  commands = $state<Command[]>([]);
  path = $state<Point[]>([]);
  
  // Methods for movement, state comparison, etc.
}
```

#### 1.3 Turtle Class (extends Canvas2D)
```typescript
// src/lib/canvas/Turtle.svelte.ts
export class Turtle extends Canvas2D {
  penDown = $state(true);
  color = $state('#000');
  isVisible = $state(true);
  
  move(distance: number) { /* ... */ }
  turn(degrees: number) { /* ... */ }
}
```

### Phase 2: Grid Robot (Week 2)

#### 2.1 GridRobot Class
```typescript
// src/lib/canvas/GridRobot.svelte.ts
export class GridRobot extends Canvas2D {
  cellX = $state(0);
  cellY = $state(0);
  gridCols: number;
  gridRows: number;
  
  // Grid state
  walls = $state<Set<string>>(new Set());
  items = $state<Map<string, Item>>(new Map()); // coins, food, etc.
  goal = $state<Point | null>(null);
  
  // Robot state
  inventory = $state<Item[]>([]);
  isHappy = $state(false);
  
  // Movement
  moveUp() { /* check walls, move, collect items */ }
  moveDown() { /* ... */ }
  moveLeft() { /* ... */ }
  moveRight() { /* ... */ }
  
  // Sensors (for conditionals)
  canMoveUp(): boolean { /* check if wall */ }
  hasItemAhead(): boolean { /* check for collectible */ }
  isAtGoal(): boolean { /* ... */ }
  
  // Actions
  collect() { /* pick up item at current cell */ }
  eat() { /* consume food, become happy */ }
}
```

#### 2.2 Robot Blocks
```typescript
// src/lib/blockly/robotBlocks.ts
Blockly.Blocks['robot_move_up'] = { /* ... */ };
Blockly.Blocks['robot_move_down'] = { /* ... */ };
Blockly.Blocks['robot_move_left'] = { /* ... */ };
Blockly.Blocks['robot_move_right'] = { /* ... */ };
Blockly.Blocks['robot_collect'] = { /* ... */ };
Blockly.Blocks['robot_eat'] = { /* ... */ };

// Sensor blocks (return boolean)
Blockly.Blocks['robot_can_move_up'] = { /* ... */ };
Blockly.Blocks['robot_has_item_ahead'] = { /* ... */ };
Blockly.Blocks['robot_is_at_goal'] = { /* ... */ };
Blockly.Blocks['robot_is_happy'] = { /* ... */ };
```

#### 2.3 GridCanvas Component
```svelte
<!-- src/lib/components/GridCanvas.svelte -->
<script lang="ts">
  import { GridRobot } from '$lib/canvas/GridRobot.svelte';
  
  let { 
    robot = $bindable(new GridRobot(8, 8)),
    editable = false  // For teacher to place walls/items
  } = $props();
</script>

<!-- Grid rendering with walls, items, robot -->
```

### Phase 3: CMS - Exercise Editor (Week 2-3)

#### 3.1 Exercise Types Configuration
```typescript
// src/lib/exercises/types.ts
export const EXERCISE_TYPES = {
  turtle: {
    name: 'Turtle Graphics',
    component: TurtleCanvas,
    engine: Turtle,
    blocks: TURTLE_BLOCKS,
    grader: gradeTurtle
  },
  robot: {
    name: 'Grid Robot',
    component: GridCanvas,
    engine: GridRobot,
    blocks: ROBOT_BLOCKS,
    grader: gradeRobot
  }
} as const;
```

#### 3.2 Exercise Editor Features
- [ ] Type selector (turtle/robot)
- [ ] Title/description with DE/EN tabs
- [ ] Visual toolbox builder (checkboxes)
- [ ] **Canvas drawing mode:**
  - Turtle: Click to draw target path
  - Robot: Click to place walls, items, goal
- [ ] Blockly workspace for solution
- [ ] Test case editor
- [ ] Hint editor (progressive)
- [ ] Age range selector
- [ ] Preview mode (play as student)
- [ ] Save/publish

#### 3.3 Example: "Hungry Robot" Exercise
```json
{
  "type": "robot",
  "title": { "de": "Hungriger Roboter", "en": "Hungry Robot" },
  "description": { 
    "de": "Der Roboter ist hungrig! Hilf ihm, die Birne zu finden und zu essen.",
    "en": "The robot is hungry! Help it find the pear and eat it."
  },
  "ageRange": { "min": 8, "max": 10 },
  "toolbox": ["robot_move_up", "robot_move_down", "robot_move_left", 
              "robot_move_right", "robot_eat", "controls_if", 
              "robot_has_item_ahead"],
  "grid": {
    "cols": 5, "rows": 5,
    "robot": { "x": 0, "y": 0 },
    "items": [{ "x": 3, "y": 2, "type": "pear" }],
    "walls": []
  },
  "grader": {
    "type": "state",
    "expected": {
      "isHappy": true,
      "inventory": []  // Pear should be eaten, not just collected
    }
  },
  "hints": [
    { "de": "Bewege den Roboter zur Birne.", "en": "Move the robot to the pear." },
    { "de": "Wenn du bei der Birne bist, iss sie!", "en": "When you're at the pear, eat it!" },
    { "de": "3× rechts, 2× runter, dann essen", "en": "3× right, 2× down, then eat" }
  ]
}
```

### Phase 4: CMS - Course Editor (Week 3)

#### 4.1 Course Editor Features
- [ ] Course metadata (title, description, age range)
- [ ] Exercise list with drag-to-reorder
- [ ] Add existing exercise or create new
- [ ] Prerequisites (exercise B requires passing A)
- [ ] Publish/unpublish course

#### 4.2 Course Assignment
- [ ] Assign to class (all students)
- [ ] Assign to age group
- [ ] Due date (optional)

### Phase 5: Student Experience (Week 3-4)

#### 5.1 Course Browser
- [ ] Filter by age, difficulty, topic
- [ ] Progress indicators
- [ ] Recommended next course

#### 5.2 Exercise Player
- [ ] Load exercise with correct engine (Turtle/Robot)
- [ ] Blockly with exercise-specific toolbox
- [ ] Run button (execute code)
- [ ] Check button (grade solution)
- [ ] Hint system (progressive reveal)
- [ ] Success celebration 🎉
- [ ] "Next Exercise" button

#### 5.3 Progress Tracking
- [ ] Exercises completed
- [ ] Time spent
- [ ] Hints used
- [ ] Attempts per exercise

### Phase 6: Security & Sandbox (Week 4)

#### 6.1 Code Execution Sandbox
```typescript
// src/lib/sandbox/executor.ts
export async function executeInSandbox(
  code: string,
  api: Record<string, Function>,
  options: { timeout: number; maxCommands: number }
): Promise<ExecutionResult> {
  // 1. Inject loop trap
  const instrumentedCode = injectLoopTrap(code, options.maxCommands);
  
  // 2. Create restricted scope
  const restrictedGlobals = {
    ...api,
    // No window, document, fetch, etc.
  };
  
  // 3. Execute with timeout
  return Promise.race([
    runCode(instrumentedCode, restrictedGlobals),
    timeout(options.timeout)
  ]);
}
```

#### 6.2 Loop Trap
```typescript
// src/lib/sandbox/loop-trap.ts
export function injectLoopTrap(code: string, maxIterations: number): string {
  // Add counter to all loops
  // Throw error if exceeded
}
```

#### 6.3 API Whitelist
```typescript
// Only these functions available to student code
const TURTLE_API = {
  move: (dist: number) => turtle.move(dist),
  turn: (deg: number) => turtle.turn(deg),
  penUp: () => turtle.penUp(),
  penDown: () => turtle.penDownFn(),
  // No: fetch, localStorage, document, window
};
```

### Phase 7: Deployment (Week 4)

#### 7.1 Docker Setup
```dockerfile
# Dockerfile
FROM oven/bun:1 as builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "./build"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data  # SQLite database
    environment:
      - DATABASE_URL=file:/app/data/db.sqlite
      - AUTH_SECRET=${AUTH_SECRET}
      - PRIVACY_MODE=strict
```

#### 7.2 Environment Variables
```env
# .env.example
DATABASE_URL=file:./data/db.sqlite
AUTH_SECRET=generate-a-secure-key

# Privacy settings
PRIVACY_MODE=strict          # No external calls
LOG_LEVEL=error              # Minimal logging
ANALYTICS=off                # No tracking

# Optional features
ENABLE_LLM_HINTS=false       # AI hint generation
LLM_API_KEY=                 # If enabled
```

---

## 🧪 Testing Strategy

### Unit Tests
- [ ] Canvas2D class methods
- [ ] Turtle movement calculations
- [ ] GridRobot collision detection
- [ ] Grader logic (turtle, robot)
- [ ] Loop trap detection

### Integration Tests
- [ ] Blockly → Code generation → Execution → Grading
- [ ] Exercise save → load → play
- [ ] Course assignment → student access

### E2E Tests (Playwright)
- [ ] Teacher creates exercise
- [ ] Student completes exercise
- [ ] Progress is saved
- [ ] Hint reveal works

---

## 📅 Timeline Summary

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Core Engine | Canvas2D, Turtle working, bugs fixed |
| 2 | Grid Robot + Editor | GridRobot, Exercise Editor, 5 exercises each |
| 3 | CMS + Courses | Course Editor, assignment, student view |
| 4 | Polish + Deploy | Sandbox, Docker, documentation |
| 5-8 | Content + Thesis | 15+ exercises, write thesis chapters |
| 9-10 | Evaluation | Pilot study, iterations |
| 11-12 | Thesis Writing | Complete and submit |

---

## ✅ Next Steps (This Week)

1. **Fix remaining bugs:**
   - [ ] TurtleCanvas NaN handling in `$effect`
   - [ ] Grader typos in `turtle.ts`
   - [ ] BlocklyWorkspace export functions

2. **Implement Canvas2D base class:**
   - [ ] Create `src/lib/canvas/Canvas2D.svelte.ts`
   - [ ] Create `src/lib/canvas/Turtle.svelte.ts`
   - [ ] Update TurtleCanvas to use new Turtle class

3. **Test end-to-end turtle flow:**
   - [ ] Create exercise in demo page
   - [ ] Draw target path
   - [ ] Student solves with blocks
   - [ ] Grading works

4. **Start GridRobot:**
   - [ ] Create GridRobot class
   - [ ] Create robot blocks
   - [ ] Create GridCanvas component

---

## 🎯 MVP Checklist

**Must have for thesis demo:**
- [x] Blockly workspace renders
- [x] Turtle moves on canvas
- [ ] Teacher can draw target path
- [ ] Exercise saves to database
- [ ] Student can play exercise
- [ ] Grading shows pass/fail
- [ ] Grid Robot type works
- [ ] 10 example exercises
- [ ] Docker deployment works

**Nice to have:**
- [ ] Multiple exercise types (I/O)
- [ ] LLM hint generation
- [ ] Class management
- [ ] Progress analytics
- [ ] PWA/offline mode
