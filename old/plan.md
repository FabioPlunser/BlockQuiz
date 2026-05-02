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

| Exercise        | Age   | Concepts        | Description                                       |
| --------------- | ----- | --------------- | ------------------------------------------------- |
| Draw a Line     | 6-7   | Sequence        | Move turtle forward                               |
| Follow the Path | 6-8   | Sequence        | Follow teacher-drawn line on grid (no walls)      |
| Hungry Turtle   | 8-10  | Sequence        | Reach an apple on the grid, turtle "eats" it      |
| Turtle Maze     | 9-11  | Conditionals    | Avoid gray walls, reach the apple safely          |
| Smart Turtle    | 11-12 | Conditionals    | Choose a safe path using if/else (multiple paths) |
| Draw a Square   | 7-8   | Loop            | Repeat 4x: move + turn 90°                        |
| Draw a Triangle | 8-9   | Loop + Math     | Repeat 3x: move + turn 120°                       |
| Draw a Star     | 9-10  | Loop + Math     | Repeat 5x: move + turn 144°                       |
| Spiral          | 10-12 | Loop + Variable | Increasing move distance                          |
| House           | 10-12 | Functions       | Combine square + triangle                         |
| Maze Navigation | 10-12 | Conditional     | Navigate around walls to reach goal               |

### Type 2: Grid Robot 🤖 (To Implement)

**Concepts:** Sequences, loops, conditionals
**Ages:** 6-10 (simpler than turtle - no angles)

| Exercise        | Age   | Concepts           | Description                        |
| --------------- | ----- | ------------------ | ---------------------------------- |
| Reach the Star  | 6-7   | Sequence           | Move on a 5x5 grid to reach a star |
| Collect Coins   | 7-8   | Sequence           | Pick up all coins on path          |
| Maze Runner     | 8-9   | Loop               | Repeat moves until at goal         |
| Hungry Robot    | 8-10  | Conditional        | IF food nearby THEN eat            |
| Wall Avoider    | 9-10  | Conditional        | IF wall ahead THEN turn            |
| Smart Collector | 10-12 | Loop + Conditional | Collect all items, avoid walls     |

### Type 3: I/O Text (Optional)

**Concepts:** Variables, math, logic
**Ages:** 10-12

| Exercise    | Age   | Concepts           | Description                      |
| ----------- | ----- | ------------------ | -------------------------------- |
| Double It   | 10-11 | Variable           | Input N, output N\*2             |
| Sum 1 to N  | 11-12 | Loop + Accumulator | Calculate sum                    |
| Even or Odd | 11-12 | Conditional        | Check divisibility               |
| Times Table | 11-12 | Loop               | Print multiplication table for N |

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
  grader_config JSON,     -- Tests, targets, tolerances, pathOverlay, walls
                          -- Structure:
                          -- {
                          --   type: 'turtle' | 'robot',
                          --   pathOverlay?: { points: Point[], color: string, width: number },
                          --   targetPoints?: TargetPoint[],
                          --   walls?: Point[],
                          --   tests: Array<{
                          --     id: string,
                          --     type: 'target' | 'path' | 'state',
                          --     expected: { target?: TargetPoint, path?: Point[], state?: Canvas2DState }
                          --   }>
                          -- }
  hints JSON,             -- Progressive hints [{de, en}]
  solution_xml TEXT,      -- Reference solution
  canvas_config JSON,     -- Grid settings, dimensions, overlay config
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
│   │   ├── TurtleCanvas.svelte       # Canvas with grid overlay support
│   │   ├── GridCanvas.svelte
│   │   ├── Canvas2DEditor.svelte    # Shared editor for all Canvas2D exercises
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

#### 1.1.1 Unified Canvas2D Blocks Architecture

**Goal:** One set of blocks (`canvas_move`, `canvas_turn`, etc.) that work with ALL Canvas2D exercises (Turtle, GridRobot, future exercises).

```typescript
// src/lib/blockly/canvasBlocks.ts
// Register ONCE - works for all Canvas2D exercises
export function registerCanvasBlocks() {
	// Core blocks: move, turn, reset (always available)
	// Optional blocks: penUp, penDown, color (only if exercise supports)
}

// Exercise declares supported features
export interface Canvas2D {
	getSupportedFeatures(): string[]; // ['pen', 'color'] or []
}
```

**Benefits:**

- No duplicate block definitions
- Consistent API across exercises
- Easy to add new exercise types

#### 1.2 Canvas2D Base Class

```typescript
// src/lib/canvas/Canvas2D.svelte.ts
export class Canvas2D {
	state = $state<Canvas2DState>({ x: 0, y: 0, angle: 0 });
	commands = $state<Command[]>([]);
	readonly width: number;
	readonly height: number;

	// Grid overlay support
	gridEnabled = $state(false);
	gridSize = $state(40); // pixels per cell

	// Teacher-drawn elements (for exercises)
	pathOverlay = $state<PathOverlay | null>(null);
	targetPoints = $state<TargetPoint[]>([]);
	walls = $state<Point[]>([]); // For turtle maze exercises

	// Core movement methods
	move(distance: number): void;
	turn(degrees: number): void;
	reset(): void;

	// State comparison for grading
	compareState(target: Canvas2DState, tolerance: number): ComparisonResult;
	comparePath(target: Point[], tolerance: number): { score: number; matches: boolean[] };
}
```

#### 1.3 Turtle Class (extends Canvas2D)

```typescript
// src/lib/canvas/Turtle.svelte.ts
export class Turtle extends Canvas2D {
	penDown = $state(true);
	color = $state('#000000');
	visible = $state(true);
	path = $state<PathSegment[]>([]); // Drawn path segments

	// Override move to track path when pen is down
	override move(distance: number): void {
		const from = { x: this.state.x, y: this.state.y };
		super.move(distance);
		if (this.penDown) {
			this.path.push({
				from,
				to: { x: this.state.x, y: this.state.y },
				color: this.color,
				width: 2
			});
		}
	}

	penUp(): void;
	penDown(): void;
	setColor(hex: string): void;
	goto(x: number, y: number): void;
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
	moveUp() {
		/* check walls, move, collect items */
	}
	moveDown() {
		/* ... */
	}
	moveLeft() {
		/* ... */
	}
	moveRight() {
		/* ... */
	}

	// Sensors (for conditionals)
	canMoveUp(): boolean {
		/* check if wall */
	}
	hasItemAhead(): boolean {
		/* check for collectible */
	}
	isAtGoal(): boolean {
		/* ... */
	}

	// Actions
	collect() {
		/* pick up item at current cell */
	}
	eat() {
		/* consume food, become happy */
	}
}
```

#### 2.2 Robot Blocks

```typescript
// src/lib/blockly/robotBlocks.ts
Blockly.Blocks['robot_move_up'] = {
	/* ... */
};
Blockly.Blocks['robot_move_down'] = {
	/* ... */
};
Blockly.Blocks['robot_move_left'] = {
	/* ... */
};
Blockly.Blocks['robot_move_right'] = {
	/* ... */
};
Blockly.Blocks['robot_collect'] = {
	/* ... */
};
Blockly.Blocks['robot_eat'] = {
	/* ... */
};

// Sensor blocks (return boolean)
Blockly.Blocks['robot_can_move_up'] = {
	/* ... */
};
Blockly.Blocks['robot_has_item_ahead'] = {
	/* ... */
};
Blockly.Blocks['robot_is_at_goal'] = {
	/* ... */
};
Blockly.Blocks['robot_is_happy'] = {
	/* ... */
};
```

#### 2.3 GridCanvas Component

```svelte
<!-- src/lib/components/GridCanvas.svelte -->
<script lang="ts">
	import { GridRobot } from '$lib/canvas/GridRobot.svelte';

	let {
		robot = $bindable(new GridRobot(8, 8)),
		editable = false, // For teacher to place walls/items
		gridEnabled = true, // Grid overlay always on for robot
		drawingMode = null // 'wall' | 'item' | 'goal' | null
	} = $props();
</script>

<!-- Grid rendering with walls, items, robot -->
```

#### 2.4 Canvas2D Editor Component (Shared)

```svelte
<!-- src/lib/components/Canvas2DEditor.svelte -->
<script lang="ts">
	import type { Canvas2D } from '$lib/canvas/Canvas2D.svelte';

	let { engine, editable = false, onPathDrawn, onTargetPlaced, onWallPlaced } = $props();

	let gridEnabled = $state(false);
	let drawingMode = $state<'path' | 'target' | 'wall' | null>(null);

	function handleCanvasClick(e: MouseEvent) {
		if (!editable || !drawingMode) return;
		const point = getCanvasPoint(e);

		if (drawingMode === 'path') {
			// Add to path overlay
		} else if (drawingMode === 'target') {
			onTargetPlaced?.(point);
		} else if (drawingMode === 'wall') {
			onWallPlaced?.(point);
		}
	}
</script>

<div class="canvas-editor">
	<div class="toolbar">
		<button onclick={() => (gridEnabled = !gridEnabled)}>
			{gridEnabled ? 'Hide Grid' : 'Show Grid'}
		</button>
		{#if editable}
			<button onclick={() => (drawingMode = drawingMode === 'path' ? null : 'path')}>
				Draw Path
			</button>
			<button onclick={() => (drawingMode = drawingMode === 'target' ? null : 'target')}>
				Place Apple
			</button>
			<button onclick={() => (drawingMode = drawingMode === 'wall' ? null : 'wall')}>
				Place Wall
			</button>
		{/if}
	</div>
	<!-- Canvas component with grid overlay -->
</div>
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
- [ ] **Canvas drawing mode with grid overlay:**
  - **Grid toggle**: Enable/disable grid overlay (40px cells default)
  - **Draw Path mode**: Click-and-drag to draw target path for student to follow
    - Path stored as `PathOverlay` with points array
    - Visual feedback: dashed line preview
    - Clear/undo last point buttons
  - **Place Target mode**: Click to place apple/target point
    - Each target creates a test case (`type: 'target'`)
    - Configurable tolerance (default 20px)
    - Visual indicator: green circle with apple icon
  - **Place Wall mode** (for maze exercises): Click to place walls
    - Walls stored as `Point[]` array
    - Visual indicator: gray rectangles
    - Can be used for collision detection in advanced exercises
- [ ] Blockly workspace for solution
- [ ] Test case editor (target, path, state)
- [ ] Hint editor (progressive)
- [ ] Age range selector
- [ ] Preview mode (play as student)
- [ ] Save/publish

#### 3.3 Example: "Follow the Path" Exercise (Turtle)

```json
{
	"type": "turtle",
	"title": { "de": "Folge dem Pfad", "en": "Follow the Path" },
	"description": {
		"de": "Zeichne den Pfad nach, den der Lehrer gezeichnet hat.",
		"en": "Trace the path that the teacher has drawn."
	},
	"ageRange": { "min": 6, "max": 8 },
	"canvas_config": {
		"gridEnabled": true,
		"gridSize": 40,
		"width": 400,
		"height": 400
	},
	"grader": {
		"type": "turtle",
		"pathOverlay": {
			"points": [
				{ "x": 200, "y": 200 },
				{ "x": 240, "y": 200 },
				{ "x": 240, "y": 240 },
				{ "x": 280, "y": 240 }
			],
			"color": "#ff0000",
			"width": 2
		},
		"tests": [
			{
				"id": "path-match",
				"type": "path",
				"expected": {
					"path": [
						/* same points as pathOverlay */
					]
				}
			}
		]
	}
}
```

#### 3.4 Example: "Reach the Apple" Exercise (Turtle)

```json
{
	"type": "turtle",
	"title": { "de": "Erreiche den Apfel", "en": "Reach the Apple" },
	"description": {
		"de": "Bewege die Schildkröte zum Apfel.",
		"en": "Move the turtle to the apple."
	},
	"ageRange": { "min": 7, "max": 9 },
	"canvas_config": {
		"gridEnabled": true,
		"gridSize": 40
	},
	"grader": {
		"type": "turtle",
		"targetPoints": [{ "x": 320, "y": 280, "tolerance": 20 }],
		"tests": [
			{
				"id": "reach-apple",
				"type": "target",
				"expected": {
					"target": { "x": 320, "y": 280, "tolerance": 20 }
				}
			}
		]
	}
}
```

#### 3.5 Example: "Hungry Robot" Exercise

```json
{
	"type": "robot",
	"title": { "de": "Hungriger Roboter", "en": "Hungry Robot" },
	"description": {
		"de": "Der Roboter ist hungrig! Hilf ihm, die Birne zu finden und zu essen.",
		"en": "The robot is hungry! Help it find the pear and eat it."
	},
	"ageRange": { "min": 8, "max": 10 },
	"toolbox": [
		"robot_move_up",
		"robot_move_down",
		"robot_move_left",
		"robot_move_right",
		"robot_eat",
		"controls_if",
		"robot_has_item_ahead"
	],
	"grid": {
		"cols": 5,
		"rows": 5,
		"robot": { "x": 0, "y": 0 },
		"items": [{ "x": 3, "y": 2, "type": "pear" }],
		"walls": []
	},
	"grader": {
		"type": "state",
		"expected": {
			"isHappy": true,
			"inventory": [] // Pear should be eaten, not just collected
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
		...api
		// No window, document, fetch, etc.
	};

	// 3. Execute with timeout
	return Promise.race([runCode(instrumentedCode, restrictedGlobals), timeout(options.timeout)]);
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
	penDown: () => turtle.penDownFn()
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
      - '3000:3000'
    volumes:
      - ./data:/app/data # SQLite database
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
- [ ] Canvas2D grid overlay calculations
- [ ] Canvas2D path comparison logic
- [ ] Canvas2D target point distance calculations
- [ ] Turtle movement calculations
- [ ] Turtle path tracking (pen up/down)
- [ ] GridRobot collision detection
- [ ] Grader logic (turtle, robot)
  - [ ] Path comparison grading
  - [ ] Target reaching grading
  - [ ] State comparison grading
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

| Week  | Focus               | Deliverables                                 |
| ----- | ------------------- | -------------------------------------------- |
| 1     | Core Engine         | Canvas2D, Turtle working, bugs fixed         |
| 2     | Grid Robot + Editor | GridRobot, Exercise Editor, 5 exercises each |
| 3     | CMS + Courses       | Course Editor, assignment, student view      |
| 4     | Polish + Deploy     | Sandbox, Docker, documentation               |
| 5-8   | Content + Thesis    | 15+ exercises, write thesis chapters         |
| 9-10  | Evaluation          | Pilot study, iterations                      |
| 11-12 | Thesis Writing      | Complete and submit                          |

---

## ✅ Next Steps (This Week)

1. **Fix remaining bugs:**
   - [ ] TurtleCanvas NaN handling in `$effect`
   - [ ] Grader typos in `turtle.ts`
   - [ ] BlocklyWorkspace export functions

2. **Implement Canvas2D base class:**
   - [ ] Create `src/lib/canvas/Canvas2D.svelte.ts` with grid support
   - [ ] Create `src/lib/canvas/Turtle.svelte.ts`
   - [ ] Update TurtleCanvas to use new Turtle class
   - [ ] Add grid overlay rendering to TurtleCanvas
   - [ ] Add path overlay rendering (teacher-drawn paths)
   - [ ] Add target point rendering (apples/targets)

3. **Implement Canvas2D Editor for teachers:**
   - [ ] Create `src/lib/components/Canvas2DEditor.svelte`
   - [ ] Grid toggle button
   - [ ] Drawing mode selector (path/target/wall)
   - [ ] Click handlers for placing elements
   - [ ] Visual feedback for drawing
   - [ ] Save drawn elements to exercise config

4. **Test end-to-end turtle flow:**
   - [ ] Create exercise in demo page
   - [ ] Enable grid overlay
   - [ ] Draw target path (teacher mode)
   - [ ] Place apple/target point
   - [ ] Student solves with blocks
   - [ ] Grading works (path comparison + target reaching)

5. **Start GridRobot:**
   - [ ] Create GridRobot class
   - [ ] Create robot blocks
   - [ ] Create GridCanvas component

---

## 🎯 MVP Checklist

**Must have for thesis demo:**

- [x] Blockly workspace renders
- [x] Turtle moves on canvas
- [ ] Grid overlay can be enabled/disabled
- [ ] Teacher can draw target path on grid
- [ ] Teacher can place apples/targets on grid
- [ ] Teacher can place walls (for maze exercises)
- [ ] Path comparison grading works
- [ ] Target reaching grading works
- [ ] Exercise saves to database
- [ ] Student can play exercise
- [ ] Grading shows pass/fail
- [ ] Grid Robot type works
- [ ] 10 example exercises (including path following and target reaching)
- [ ] Docker deployment works

**Nice to have:**

- [ ] Multiple exercise types (I/O)
- [ ] LLM hint generation
- [ ] Class management
- [ ] Progress analytics
- [ ] PWA/offline mode
