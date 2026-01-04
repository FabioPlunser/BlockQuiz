# AI Chat Log: Turtle Exercise and CMS Integration Plan

## Overview

This document captures the analysis and implementation plan for integrating the turtle example into the CMS system, based on scanning the project directory. The goal is to enable teachers to create/edit turtle exercises in courses and students to solve them with feedback, while ensuring SPA-like navigation and proper translation storage.

## Current State Analysis

### Turtle Example

- **Components**:
  - `TurtleCanvas.svelte`: Canvas with turtle drawing, command logging (`move:20`, `turn:90`), overlays for targets/paths, and API for movement.
  - `ExerciseEditor.svelte`: Form for authoring (title, description, hints, toolbox, grader config). Includes BlocklyWorkspace and TurtleCanvas for building solutions.
  - `graders/turtle.ts`: Grading logic for target/command/state tests, with simulation.
- **Gaps**:
  - No full exercise flow: No student-solving page, no sandbox execution, no feedback UI.
  - No persistence: Exercises not saved/loaded from DB.
  - No CMS integration: CMS has placeholders but no exercise editing.
  - UI/UX rough: Missing hints, progress, animations.

### CMS System

- **Routes/Pages**:
  - `/cms/+page.svelte`: Main CMS with tabs (Courses, Exercises), course cards (temp data), and placeholders for course/exercise views. Uses query params (`?courseId=123`) for navigation.
- **DB Integration**: Schema supports `courses` and `exercises`, but CMS uses static `tempCourses`. No API calls yet.
- **Gaps**:
  - No exercise creation/editing: Only placeholders.
  - No course management: Add/edit exercises in courses.
  - Navigation issues: Query params cause refetches.
  - No translations or pedagogical features.

## Implementation Plan

### Step 1: Set Up Exercise Routes with Slugs

- **Why**: For shareable URLs and easier navigation.
- **Files to Create/Edit**:
  - New: `src/routes/(app)/cms/exercise/[slug]/+page.svelte` (teacher editing).
  - New: `src/routes/(app)/exercise/[slug]/+page.svelte` (student solving).
- **Pseudocode for Teacher Page**:

  ```svelte
  <script lang="ts">
  	import { page } from '$app/state';
  	import ExerciseEditor from '$cp/ExerciseEditor.svelte';
  	import { loadExercise, saveExercise } from '$lib/remote/exercises.remote.ts'; // Assume you create this API

  	let slug = $derived(page.params.slug);
  	let exercise = $state(null);

  	// Load on mount
  	$effect(() => {
  		if (slug) {
  			loadExercise(slug).then((data) => (exercise = data));
  		}
  	});

  	function handleSave(updatedExercise) {
  		saveExercise(slug, updatedExercise);
  	}
  </script>

  {#if exercise}
  	<ExerciseEditor {exercise} onSave={handleSave} />
  {/if}
  ```

- **Instructions**: Create the file, import components, add load/save logic. For student page, similar but read-only with run/check.

### Step 2: Integrate Turtle Example into CMS

- **Update CMS Main Page** (`src/routes/(app)/cms/+page.svelte`):
  - Replace temp data with DB queries (create `loadCourses` API).
  - Change navigation to slugs: `goto('/cms/exercise/${exercise.slug}')`.
  - Add "Create Exercise" button in course view.
- **Pseudocode Addition**:
  ```svelte
  // In course view
  <button onclick={() => goto('/cms/exercise/new')}>Create Exercise</button>
  <!-- List exercises -->
  {#each course.exercises as ex}
  	<div onclick={() => goto('/cms/exercise/${ex.slug}')}>{ex.title}</div>
  {/each}
  ```
- **Instructions**: Modify the existing page. Add DB loading in `+page.ts` (SvelteKit load function).

### Step 3: Add Persistence and API

- **Create API** (`src/lib/remote/exercises.remote.ts`):
  - Functions: `loadExercise(slug)`, `saveExercise(slug, data)`, `createExercise(courseId, data)`.
- **Pseudocode**:

  ```ts
  export async function loadExercise(slug: string) {
  	const response = await fetch(`/api/exercises/${slug}`);
  	return response.json();
  }

  export async function saveExercise(slug: string, data: any) {
  	await fetch(`/api/exercises/${slug}`, { method: 'PUT', body: JSON.stringify(data) });
  }
  ```

- **Server Endpoint**: Create `src/routes/api/exercises/[slug]/+server.ts` for GET/PUT.
- **Instructions**: Implement server logic to query/update DB (`exercises` table).

### Step 4: Implement Sandbox and Grading for Turtle

- **Add Sandbox Component** (`src/lib/components/Sandbox.svelte`):
  - Iframe for execution, postMessage for code/run.
- **Update TurtleCanvas**: Integrate sandbox for student runs.
- **Pseudocode for Student Page**:

  ```svelte
  <script>
  	import TurtleCanvas from '$cp/TurtleCanvas.svelte';
  	import BlocklyWorkspace from '$cp/BlocklyWorkspace.svelte';
  	import { gradeTurtle } from '$lib/graders/turtle.ts';

  	let commandLog = $state([]);
  	let feedback = $state([]);

  	function runCode() {
  		// Execute in sandbox, collect commandLog
  		feedback = gradeTurtle(commandLog, exercise.grader.tests);
  	}
  </script>

  <BlocklyWorkspace toolbox={exercise.toolbox} />
  <TurtleCanvas bind:commandLog />
  <button onclick={runCode}>Check</button>
  <!-- Show feedback -->
  {#each feedback as test}
  	<div class={test.passed ? 'success' : 'error'}>{test.message}</div>
  {/each}
  ```

- **Instructions**: Embed in student route. Add timeout/loop-trap in sandbox.

### Step 5: Polish UI/UX and Pedagogical Features

- **Hints and Progress**: In student page, add expandable hints, progress bar.
- **Animations**: In TurtleCanvas, animate movements.
- **Pedagogical**: Pre-seed 10 exercises in DB (e.g., square, triangle).
- **Pseudocode for Hints**:
  ```svelte
  let shownHints = $state(0);
  <button onclick={() => shownHints++}>Show Hint</button>
  {#each exercise.hints.slice(0, shownHints) as hint}
  	<p>{hint}</p>
  {/each}
  ```
- **Instructions**: Add to components. Test with sample data.

### Step 6: Testing and Iteration

- Run locally, test navigation, grading.
- Add E2E tests for turtle flow.
- Iterate based on UX (e.g., add encouragement messages).

## Navigation and Translation Decisions

### SPA Feel vs. Slugs

- **Slugs Recommended**: Easier to implement, shareable URLs, better UX. Use SvelteKit's caching to avoid refetches.
- **SPA State Option**: Use Svelte stores for in-memory state if true SPA feel is critical (more complex).

### Translation Storage

- **Hybrid Approach**: Keep JSON for static UI strings (fast, simple). Use DB for dynamic content (exercise titles, hints) to allow teacher edits.
- **Implementation**: Update i18n to load JSON for UI, fetch DB for content. Add CMS tab for DB translations.

## Next Steps

1. Start with Step 1: Create exercise routes with slugs.
2. Build incrementally, testing each step.
3. Focus on turtle example first, then generalize for other exercise types.
4. Ensure pedagogical design (one learning goal per exercise, playful themes).

This plan provides a starting point—implement yourself for accuracy. Ask for clarification on any pseudocode or next steps.
