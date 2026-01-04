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

	type Props = {
		exercise: Exercise;
		currentIndex: number;
		totalExercises: number;
		onSubmit: (result: GradingResult) => void;
		onNext: () => void;
		hasNextExercise: boolean;
	};

	let { exercise, currentIndex, totalExercises, onSubmit, onNext, hasNextExercise }: Props = $props();

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
</script>

<div class="flex h-full gap-4">
	<!-- Left Sidebar: Exercise Info -->
	<div class="w-80 shrink-0 overflow-hidden rounded-lg border border-base-300">
		<ExerciseInfoPanel {exercise} {currentIndex} {totalExercises} />
	</div>

	<!-- Right Main Area: Blockly + Execution -->
	<div class="flex flex-1 flex-col gap-4 overflow-hidden">
		<!-- Blockly Workspace -->
		<div class="flex-1 overflow-hidden rounded-lg border border-base-300">
			{#key exercise.id}
				<BlocklyWorkspace
					bind:this={blocklyRef}
					toolboxConfig={getToolbox()}
					starterXml={exercise.config.hasStarterBlocks ? exercise.config.starterXml : ''}
				/>
			{/key}
		</div>

		<!-- Execution Area: Canvas + Controls + Results -->
		<div class="shrink-0">
			<ExecutionArea
				{exercise}
				{getCode}
				{hasNextExercise}
				onSubmit={handleSubmit}
				{onNext}
			/>
		</div>
	</div>
</div>

<style>
	/* Ensure the Blockly workspace fills its container */
	:global(.blocklyWorkspace) {
		height: 100% !important;
	}
</style>

