<script lang="ts">
	import LocalizedRichText from '$cp/editor/LocalizedRichText.svelte';
	import LocalizedInput from '$cp/editor/LocalizedInput.svelte';
	import TypeModeSelector from '$cp/editor/TypeModeSelector.svelte';
	import BlockPicker from '$cp/editor/BlockPicker.svelte';
	import type { ExerciseFormData, TestCase } from '$types/exercise';
	import { MoveLeft } from '@lucide/svelte';

	import {
		Info,
		Blocks,
		Palette,
		FlaskConical,
		Lightbulb,
		Eye,
		Brush,
		Apple,
		BrickWall,
		Trash,
		Target,
		Route,
		ChevronDown,
		ChevronRight,
		Grid3X3
	} from '@lucide/svelte';
	import { createDefaultExerciseFormData } from '$types/exercise';
	import BlocklyWorkspace from '$cp/BlocklyWorkspace.svelte';
	import type { BlocklyToolboxConfig, BlocklyCategoryConfig } from '$lib/blockly/types';
	import { BlocklyToolboxKind } from '$lib/blockly/types';
	import { Turtle } from '$lib/canvas/Turtle.svelte';
	import { Robot } from '$lib/canvas/Robot.svelte';
	import { getCategoryForBlocks } from '$lib/blockly/BlocklyFactory';
	import { LOGIC_BLOCKS, LOOP_BLOCKS, MATH_BLOCKS, TEXT_BLOCKS } from '$lib/blockly/presets';
	import { watch } from 'runed';
	import Canvas from '$cp/Canvas.svelte';
	import type { DrawMode, Point, TargetPoint } from '$lib/canvas/types';
	import TestCaseEditor from '$cp/editor/TestCaseEditor.svelte';
	import HintEditor from '$cp/editor/HintEditor.svelte';
	import AutoTestsPanel from '$cp/editor/AutoTestsPanel.svelte';
	import { createExercise, updateExercise } from '$remote/exercises.remote';

	// ---------------------------------------------------
	// ---------------------------------------------------
	type Props = {
		exercise?: ExerciseFormData;
		remote?: any;
		courseId?: string;
		onSave?: () => void;
		onCancel: () => void;
		isNew?: boolean;
	};

	let {
		exercise = $bindable(createDefaultExerciseFormData()),
		remote,
		courseId = '',
		onSave,
		onCancel,
		isNew = true
	}: Props = $props();
	// ---------------------------------------------------
	// ---------------------------------------------------
	let activeSection = $state<string>('basics');

	let showGrid = $state(true);
	let drawMode = $state<DrawMode>(null);
	let blocklyRef: BlocklyWorkspace;
	let toolboxVersion = $state(0);
	let showManualTests = $state(false);

	let pathOverlay = $derived(exercise.config.canvas.pathOverlay);
	let targets = $derived(exercise.config.canvas.targets);
	let walls = $derived(exercise.config.canvas.walls);
	
	// Derived counts for UI feedback
	let targetCount = $derived(targets.length);
	let pathPointCount = $derived(pathOverlay.length);
	let hasPath = $derived(pathOverlay.length > 1);
	let autoTestCount = $derived(targetCount + (hasPath ? 1 : 0));

	function updatePath(points: Point[]) {
		exercise.config.canvas.pathOverlay = points;
	}

	function updateTargets(t: TargetPoint[]) {
		exercise.config.canvas.targets = t;
	}

	function updateWalls(w: Point[]) {
		exercise.config.canvas.walls = w;
	}

	const sections = [
		{ id: 'basics', label: 'Basic Information', icon: Info },
		{ id: 'blocks', label: 'Blocks', icon: Blocks },
		{ id: 'canvas', label: 'Canvas & Tests', icon: Palette },
		{ id: 'hints', label: 'Hints', icon: Lightbulb },
		{ id: 'preview', label: 'Preview', icon: Eye }
	];
	// ---------------------------------------------------
	// Blockly
	// ---------------------------------------------------
	function getEngine() {
		return exercise.type === 'turtle' ? new Turtle(400, 400) : new Robot(400, 400);
	}
	// Build toolbox config from selected blocks
	function buildBuiltinCategories(): BlocklyCategoryConfig[] {
		const makeCategory = (name: string, colour: number, ids: string[]): BlocklyCategoryConfig => ({
			kind: 'category',
			name,
			colour,
			contents: ids
				.filter((id) => exercise.config.toolbox.includes(id))
				.map((id) => ({ kind: 'block', type: id }))
		});

		const cats: BlocklyCategoryConfig[] = [];
		const logic = makeCategory('Logic', 210, LOGIC_BLOCKS);
		if (logic.contents.length) cats.push(logic);
		const loops = makeCategory('Loops', 120, LOOP_BLOCKS);
		if (loops.contents.length) cats.push(loops);
		const math = makeCategory('Math', 230, MATH_BLOCKS);
		if (math.contents.length) cats.push(math);
		const text = makeCategory('Text', 160, TEXT_BLOCKS);
		if (text.contents.length) cats.push(text);

		return cats;
	}

	function getToolbox(): BlocklyToolboxConfig {
		const engine = getEngine();
		const prefix = exercise.type;

		// Filter engine blocks by selected
		const engineBlocks = engine.blockDefs.filter((b) => exercise.config.toolbox.includes(b.id));

		const engineCategory = getCategoryForBlocks(
			engineBlocks,
			prefix,
			exercise.type === 'turtle' ? 'Turtle' : 'Robot',
			160
		);

		const builtinCategories = buildBuiltinCategories();

		return {
			kind: BlocklyToolboxKind.CATEGORY,
			contents: [engineCategory, ...builtinCategories]
		};
	}

	watch(
		() => exercise.config.toolbox,
		() => {
			toolboxVersion += 1;
		}
	);
	function captureStarterXml() {
		if (blocklyRef) {
			exercise.config.starterXml = blocklyRef.getXml();
			exercise.config.hasStarterBlocks = true;
		}
	}
	function clearStarterXml() {
		exercise.config.starterXml = '';
		if (blocklyRef) {
			blocklyRef.clear();
		}
	}
	// ---------------------------------------------------
	// Canvas
	// ---------------------------------------------------
	function clearCanvas() {
		exercise.config.canvas.pathOverlay = [];
		exercise.config.canvas.targets = [];
		exercise.config.canvas.walls = [];
	}

	// ---------------------------------------------------
	// Auto-sync Canvas → Test Cases
	// ---------------------------------------------------
	
	/**
	 * Sync canvas targets to test cases.
	 * Clears all existing 'target' type test cases and creates new ones from canvas targets.
	 */
	function syncTargetsToTests() {
		const tolerance = exercise.config.grader.appleTolerance ?? 10;
		const canvasTargets = exercise.config.canvas.targets;
		
		// Remove all existing target-type test cases
		const nonTargetTests = exercise.config.grader.testCases.filter(t => t.type !== 'target');
		
		// Create new target test cases from canvas targets
		const targetTests: TestCase[] = canvasTargets.map((target, index) => ({
			id: `target-${target.x}-${target.y}`,
			description: {
				de: `Erreiche Ziel bei (${target.x}, ${target.y})`,
				en: `Reach target at (${target.x}, ${target.y})`
			},
			visible: true,
			type: 'target' as const,
			message: {
				de: `Ziel ${index + 1} erreicht!`,
				en: `Target ${index + 1} reached!`
			},
			expected: {
				target: {
					x: target.x,
					y: target.y,
					tolerance: target.tolerance ?? tolerance
				}
			}
		}));
		
		exercise.config.grader.testCases = [...nonTargetTests, ...targetTests];
	}
	
	/**
	 * Sync canvas path overlay to test case.
	 * Clears all existing 'path' type test cases and creates one from canvas path.
	 */
	function syncPathToTest() {
		const pathPoints = exercise.config.canvas.pathOverlay;
		
		// Remove all existing path-type test cases
		const nonPathTests = exercise.config.grader.testCases.filter(t => t.type !== 'path');
		
		// If there's a path, create a path test case
		if (pathPoints.length > 1) {
			const pathTest: TestCase = {
				id: 'path-follow',
				description: {
					de: `Folge dem gezeichneten Pfad (${pathPoints.length} Punkte)`,
					en: `Follow the drawn path (${pathPoints.length} points)`
				},
				visible: true,
				type: 'path' as const,
				message: {
					de: 'Pfad erfolgreich verfolgt!',
					en: 'Path followed successfully!'
				},
				expected: {
					path: pathPoints.map(p => ({ x: p.x, y: p.y }))
				}
			};
			
			exercise.config.grader.testCases = [...nonPathTests, pathTest];
		} else {
			exercise.config.grader.testCases = nonPathTests;
		}
	}
	
	// Watch canvas targets and sync to tests
	watch(
		() => exercise.config.canvas.targets,
		() => {
			syncTargetsToTests();
		}
	);
	
	// Watch canvas path and sync to tests
	watch(
		() => exercise.config.canvas.pathOverlay,
		() => {
			syncPathToTest();
		}
	);
	// ---------------------------------------------------
	// ---------------------------------------------------

	async function saveExercise() {
		if (isNew) {
			try {
				const result = await createExercise({
					type: exercise.type,
					content: exercise.content,
					config: exercise.config,
					courseId: exercise.courseId,
					published: exercise.published
				}).updates(remote);
				console.log(result);
			} catch (error) {
				console.error(error);
			}
		} else {
			try {
				const result = await updateExercise({
					id: exercise.id,
					type: exercise.type,
					content: exercise.content,
					config: exercise.config,
					courseId: exercise.courseId,
					published: exercise.published
				}).updates(remote);
				console.log(result);
			} catch (error) {
				console.error(error);
			}
		}
		onSave?.();
	}

	let imagePreview = $derived(exercise.content.image ?? '');
	async function handleImage(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file');
			return;
		}

		// Validate file size (e.g., max 5MB)
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (file.size > maxSize) {
			alert('Image size must be less than 5MB');
			return;
		}

		// Convert to base64
		return new Promise<void>((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = (event) => {
				const base64String = event.target?.result as string;
				exercise.content.image = base64String;
				imagePreview = base64String; // For preview
				resolve();
			};

			reader.onerror = () => {
				reject(new Error('Failed to read file'));
			};

			reader.readAsDataURL(file);
		});
	}
</script>

<div class="p-4">
	<div class="card bg-base-200 p-4 shadow-xl">
		<!-- Navigation -->
		<div class="flex items-center gap-4">
			<button class="btn btn-ghost btn-sm" onclick={() => onCancel()}>
				<MoveLeft size="32" />
			</button>
			<h1 class="text-2xl font-bold">Create Exercise</h1>
			<div class="absolute right-4 flex flex-wrap gap-4">
				<label class="label cursor-pointer gap-2">
					<input type="checkbox" class="toggle toggle-primary" bind:checked={exercise.published} />
					<span class="label-text">Published</span>
				</label>
				<button class="btn btn-primary" onclick={saveExercise}>Save</button>
			</div>
		</div>
		<div class="mt-2 mb-2 tabs">
			{#each sections as section (section.id)}
				<button
					class="tab"
					class:tab-active={activeSection === section.id}
					onclick={() => (activeSection = section.id)}
				>
					<section.icon size="24" />
					<span class="ml-2">{section.label}</span>
				</button>
			{/each}
		</div>
		{#if activeSection === 'basics'}
			<h2 class="font-bold">Basic Information</h2>
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Upload an image</legend>
				<input type="file" class="file-input" accept="image/*" onchange={handleImage} />
			</fieldset>
			{#if imagePreview}
				<button class="btn w-fit btn-sm btn-primary" onclick={() => (exercise.content.image = '')}>
					Remove Image
				</button>
			{/if}
			{#if imagePreview}
				<img src={imagePreview} alt="Exercise Preview" class="mt-2" />
			{/if}

			<div class="mt-4">
				<LocalizedInput bind:value={exercise.content.title} label="Title" />
			</div>
			<div class="mt-4">
				<LocalizedRichText bind:value={exercise.content.description} label="Description" />
			</div>
			<div class="divider"></div>
			<TypeModeSelector bind:type={exercise.type} bind:mode={exercise.config.mode} />
			<div class="divider"></div>
		{/if}

		{#if activeSection === 'blocks'}
			<h2 class="font-bold">Available Blocks</h2>
			<p class="text-sm text-base-content/60">
				Select which blocks students can use in this exercise
			</p>
			<BlockPicker bind:selectedBlocks={exercise.config.toolbox} exerciseType={exercise.type} />
			{#key `starter-${toolboxVersion}`}
				<BlocklyWorkspace
					bind:this={blocklyRef}
					toolboxConfig={getToolbox()}
					starterXml={exercise.config.starterXml}
				/>
			{/key}
			<div class="divider"></div>
			<h2 class="font-bold">Starter Blocks</h2>
			<p class="mb-3 text-sm text-base-content/60">
				Optionally provide initial blocks for students to work from
			</p>
			<label class="label mb-2 cursor-pointer justify-start gap-2">
				<input
					type="checkbox"
					class="checkbox checkbox-primary"
					bind:checked={exercise.config.hasStarterBlocks}
				/>
				<span class="label-text">Include starter blocks</span>
			</label>
			{#if exercise.config.hasStarterBlocks}
				<div class="rounded-lg border border-base-300 p-4">
					{#key `starter-${toolboxVersion}`}
						<BlocklyWorkspace
							bind:this={blocklyRef}
							toolboxConfig={getToolbox()}
							starterXml={exercise.config.starterXml}
						/>
					{/key}
					<div class="mt-2 flex gap-2">
						<button type="button" class="btn btn-sm btn-primary" onclick={captureStarterXml}>
							Save as Starter
						</button>
						<button type="button" class="btn btn-ghost btn-sm" onclick={clearStarterXml}>
							Clear Starter
						</button>
					</div>
				</div>
			{/if}
		{/if}

		{#if activeSection === 'canvas'}
			<h2 class="font-bold">Canvas & Tests</h2>
			<p class="mb-4 text-sm text-base-content/60">
				Draw paths and place targets to create test cases automatically
			</p>
			
			<!-- Toolbar -->
			<div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-base-300 p-2">
				<button
					type="button"
					class="btn btn-sm gap-1"
					class:btn-primary={showGrid}
					onclick={() => (showGrid = !showGrid)}
				>
					<Grid3X3 size="16" />
					{showGrid ? 'Hide Grid' : 'Show Grid'}
				</button>
				
				<div class="divider divider-horizontal mx-1"></div>
				
				<button
					type="button"
					class="btn btn-sm gap-1"
					class:btn-primary={drawMode === 'path'}
					onclick={() => (drawMode = drawMode === 'path' ? null : 'path')}
				>
					<Brush size="16" />
					Path
					{#if pathPointCount > 0}
						<span class="badge badge-xs badge-success">{pathPointCount}</span>
					{/if}
				</button>
				<button
					type="button"
					class="btn btn-sm gap-1"
					class:btn-error={drawMode === 'target'}
					onclick={() => (drawMode = drawMode === 'target' ? null : 'target')}
				>
					<Apple size="16" />
					Target
					{#if targetCount > 0}
						<span class="badge badge-xs badge-success">{targetCount}</span>
					{/if}
				</button>
				<button
					type="button"
					class="btn btn-sm gap-1"
					class:btn-neutral={drawMode === 'wall'}
					onclick={() => (drawMode = drawMode === 'wall' ? null : 'wall')}
				>
					<BrickWall size="16" />
					Wall
					{#if walls.length > 0}
						<span class="badge badge-xs">{walls.length}</span>
					{/if}
				</button>
				
				<div class="flex-1"></div>
				
				<button type="button" class="btn btn-ghost btn-sm gap-1" onclick={clearCanvas}>
					<Trash size="16" />
					Clear
				</button>
			</div>
			
			<!-- Draw Mode Instructions -->
			{#if drawMode}
				<div class="mb-4 alert alert-info py-2">
					<span class="text-sm">
						{#if drawMode === 'path'}
							<Brush class="mr-1 inline h-4 w-4" />
							Click to draw waypoints. This creates a <strong>path test</strong> automatically.
						{:else if drawMode === 'target'}
							<Apple class="mr-1 inline h-4 w-4" />
							Click to place targets. Each creates a <strong>target test</strong> automatically.
						{:else if drawMode === 'wall'}
							<BrickWall class="mr-1 inline h-4 w-4" />
							Click to place walls. These are obstacles the student must avoid.
						{/if}
					</span>
				</div>
			{/if}
			
			<!-- Two-column layout: Canvas (left) + Tests Panel (right) -->
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<!-- Canvas (takes 2 columns on large screens) -->
				<div class="lg:col-span-2">
					<div class="flex justify-center rounded-lg border border-base-300 bg-base-100 p-4">
						<Canvas
							engine={getEngine()}
							actorType={exercise.type === 'turtle' ? 'turtle' : 'robot'}
							editable={true}
							{showGrid}
							{drawMode}
							{pathOverlay}
							{targets}
							{walls}
							onPathChange={updatePath}
							onTargetChange={updateTargets}
							onWallsChange={updateWalls}
						/>
					</div>
				</div>
				
				<!-- Auto-generated Tests Panel (right sidebar) -->
				<div class="lg:col-span-1">
					<AutoTestsPanel
						{targets}
						{pathOverlay}
						testCases={exercise.config.grader.testCases}
						appleTolerance={exercise.config.grader.appleTolerance}
						wallTolerance={exercise.config.grader.wallTolerance}
						onAppleToleranceChange={(v) => (exercise.config.grader.appleTolerance = v)}
						onWallToleranceChange={(v) => (exercise.config.grader.wallTolerance = v)}
					/>
				</div>
			</div>
			
			<!-- Collapsed Additional Tests Section -->
			<div class="mt-6">
				<button
					type="button"
					class="flex w-full items-center gap-2 rounded-lg bg-base-300 px-4 py-3 text-left hover:bg-base-200"
					onclick={() => (showManualTests = !showManualTests)}
				>
					{#if showManualTests}
						<ChevronDown size="20" />
					{:else}
						<ChevronRight size="20" />
					{/if}
					<span class="font-medium">Additional Tests</span>
					<span class="text-sm text-base-content/60">(optional manual tests)</span>
				</button>
				
				{#if showManualTests}
					<div class="mt-2 rounded-lg border border-base-300 p-4">
						<TestCaseEditor
							bind:testCases={exercise.config.grader.testCases}
							exerciseType={exercise.type}
							exerciseMode={exercise.config.mode}
						/>
					</div>
				{/if}
			</div>
		{/if}

		{#if activeSection === 'hints'}
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Hints</h2>

					<HintEditor bind:hints={exercise.config.hints} />
				</div>
			</div>
		{/if}
	</div>
</div>
