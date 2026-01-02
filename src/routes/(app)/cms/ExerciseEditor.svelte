<script lang="ts">
	import LocalizedRichText from '$cp/editor/LocalizedRichText.svelte';
	import LocalizedInput from '$cp/editor/LocalizedInput.svelte';
	import TypeModeSelector from '$cp/editor/TypeModeSelector.svelte';
	import BlockPicker from '$cp/editor/BlockPicker.svelte';
	import type { ExerciseFormData } from '$types/exercise';
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
		Trash
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
	import ToleranceSettings from '$cp/editor/ToleranceSettings.svelte';
	import TestCaseEditor from '$cp/editor/TestCaseEditor.svelte';
	import HintEditor from '$cp/editor/HintEditor.svelte';
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

	let pathOverlay = $derived(exercise.config.canvas.pathOverlay);
	let targets = $derived(exercise.config.canvas.targets);
	let walls = $derived(exercise.config.canvas.walls);

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
		{ id: 'canvas', label: 'Canvas', icon: Palette },
		{ id: 'tests', label: 'Tests', icon: FlaskConical },
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
			<div class="divider"></div>
			<h2 class="font-bold">Canvas Setup</h2>
			<p class="text-sm text-base-content/60">
				Draw paths, place targets, and walls for the exercise
			</p>
			<div class="mb-4 flex flex-wrap gap-2">
				<button
					type="button"
					class="btn btn-sm"
					class:btn-primary={showGrid}
					onclick={() => (showGrid = !showGrid)}
				>
					{showGrid ? 'Hide Grid' : 'Show Grid'}
				</button>
				<button
					type="button"
					class="btn btn-sm"
					class:btn-primary={drawMode === 'path'}
					onclick={() => (drawMode = drawMode === 'path' ? null : 'path')}
				>
					<div class="flex items-center gap-4">
						<Brush />
						Draw Path
					</div>
				</button>
				<button
					type="button"
					class="btn btn-sm"
					class:btn-primary={drawMode === 'target'}
					onclick={() => (drawMode = drawMode === 'target' ? null : 'target')}
				>
					<div class="flex items-center gap-4">
						<Apple />
						Place Target
					</div>
				</button>
				<button
					type="button"
					class="btn btn-sm"
					class:btn-primary={drawMode === 'wall'}
					onclick={() => (drawMode = drawMode === 'wall' ? null : 'wall')}
				>
					<div class="flex items-center gap-4">
						<BrickWall />
						Place Wall
					</div>
				</button>
				<button type="button" class="btn btn-sm" onclick={clearCanvas}>
					<div class="flex items-center gap-4">
						<Trash />
						Clear All
					</div>
				</button>
			</div>
			<div class="flex justify-center">
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
			<div class="divider"></div>

			<!-- Tolerance Settings -->
			<ToleranceSettings
				bind:appleTolerance={exercise.config.grader.appleTolerance}
				bind:wallTolerance={exercise.config.grader.wallTolerance}
				exerciseMode={exercise.config.mode}
			/>
		{/if}

		{#if activeSection === 'tests'}
			<div class="card bg-base-200">
				<div class="card-body">
					<h2 class="card-title">Test Cases</h2>

					<TestCaseEditor
						bind:testCases={exercise.config.grader.testCases}
						exerciseType={exercise.type}
						exerciseMode={exercise.config.mode}
					/>
				</div>
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
