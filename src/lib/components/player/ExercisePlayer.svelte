<script lang="ts">
	import type { Exercise } from '$lib/types/exercise';
	import type { GradingResult } from '$lib/player/executor';
	import type { BlocklyToolboxConfig, BlocklyCategoryConfig } from '$lib/blockly/types';
	import { BlocklyToolboxKind } from '$lib/blockly/types';
	import BlocklyWorkspace from '$cp/BlocklyWorkspace.svelte';
	import ExerciseInfoPanel from './ExerciseInfoPanel.svelte';
	import ExecutionArea from './ExecutionArea.svelte';
	import { Turtle } from '$lib/canvas/Turtle.svelte';
	import { Robot } from '$lib/canvas/Robot.svelte';
	import { getCategoryForBlocks } from '$lib/blockly/BlocklyFactory';
	import { LOGIC_BLOCKS, LOOP_BLOCKS, MATH_BLOCKS, TEXT_BLOCKS } from '$lib/blockly/presets';
	import ResultsPanel from './ResultsPanel.svelte';
	import { getExecutionState } from './execution.svelte';

	type Props = {
		exercise: Exercise;
		currentIndex: number;
		totalExercises: number;
		onSubmit: (result: GradingResult) => void;
		onNext: () => void;
		hasNextExercise: boolean;
	};

	let { exercise, currentIndex, totalExercises, onSubmit, onNext, hasNextExercise }: Props =
		$props();

	// Get singleton state
	const state = getExecutionState();

	// Reactive access to shared state
	let result = $derived(state.result);
	let isSubmitting = $derived(state.isSubmitting);

	let blocklyRef: BlocklyWorkspace;

	// Get code from Blockly workspace
	function getCode(): string {
		if (!blocklyRef) return '';
		return blocklyRef.getCode();
	}

	// Build toolbox config from exercise configuration
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

	function getEngine() {
		const { width, height } = exercise.config.canvas;
		return exercise.type === 'turtle' ? new Turtle(width, height) : new Robot(width, height);
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

	// Handle submission
	function handleSubmit(result: GradingResult) {
		onSubmit(result);
	}

	function handleRetry() {
		state.handleRetry();
	}
</script>

<div class="flex h-[90vh] w-full gap-4">
	<!-- Left Sidebar: Exercise Info + Blockly -->
	<div class="flex w-1/3 flex-col gap-4 overflow-hidden">
		<!-- Exercise info - constrained height with scroll -->
		<div class="shrink-0 overflow-y-auto">
			<ExerciseInfoPanel {exercise} {currentIndex} {totalExercises} />
		</div>
	</div>

	<!-- Right Main Area: Blockly + Execution -->
	<!-- Blockly workspace - takes remaining space -->
	<div class="max-h-[60vh] min-h-0 flex-1 focus:outline-none">
		{#key exercise.id}
			<BlocklyWorkspace
				bind:this={blocklyRef}
				toolboxConfig={getToolbox()}
				starterXml={exercise.config.hasStarterBlocks ? exercise.config.starterXml : ''}
			/>
		{/key}
	</div>
	<div class="flex flex-col gap-4">
		<ResultsPanel {result} {isSubmitting} {hasNextExercise} onRetry={handleRetry} {onNext} />
		<ExecutionArea {exercise} {getCode} {hasNextExercise} onSubmit={handleSubmit} {onNext} />
	</div>
	<!-- <div class="flex flex-1 gap-4">
		<div class="min-w-0 flex-1"></div>
		<div>
		</div>
	</div> -->
</div>

<style>
	/* Ensure the Blockly workspace fills its container */
	:global(.blocklyWorkspace) {
		height: 100% !important;
	}

	/* Remove unwanted focus/outline styles from Blockly container */
	:global(.blocklyWorkspace:focus),
	:global(.blocklyWorkspace:focus-visible),
	:global(.blocklyMainBackground:focus) {
		outline: none !important;
		border: none !important;
		box-shadow: none !important;
	}
</style>
