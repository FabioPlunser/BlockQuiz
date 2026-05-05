<script lang="ts">
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import type { Exercise } from '$lib/types/exercise';
	import type { AttemptCapture, HintRevealEvent } from '$lib/types/attempt';
	import type { GradingResult } from '$lib/player/executor';
	import type { BlocklyToolboxConfig, BlocklyCategoryConfig } from '$lib/blockly/types';
	import { BlocklyToolboxKind } from '$lib/blockly/types';
	import BlocklyWorkspace from '$cp/BlocklyWorkspace.svelte';
	import ExerciseInfoPanel from './ExerciseInfoPanel.svelte';
	import ExecutionArea from './ExecutionArea.svelte';
	import CodeReadout from './CodeReadout.svelte';
	import { Turtle } from '$lib/canvas/Turtle.svelte';
	import { Robot } from '$lib/canvas/Robot.svelte';
	import { getCategoryForBlocks } from '$lib/blockly/BlocklyFactory';
	import {
		LOGIC_BLOCKS,
		LOOP_BLOCKS,
		MATH_BLOCKS,
		TEXT_BLOCKS,
		VARIABLE_BLOCKS
	} from '$lib/blockly/presets';
	import ResultsPanel from './ResultsPanel.svelte';
	import { getExecutionState } from './execution.svelte';

	type Props = {
		exercise: Exercise;
		currentIndex: number;
		totalExercises: number;
		onSubmit: (payload: { result: GradingResult; capture: AttemptCapture }) => void;
		onNext: () => void;
		hasNextExercise: boolean;
		initialWorkspaceXml?: string;
		initialResult?: GradingResult | null;
	};

	let {
		exercise,
		currentIndex,
		totalExercises,
		onSubmit,
		onNext,
		hasNextExercise,
		initialWorkspaceXml = '',
		initialResult = null
	}: Props = $props();

	const executionState = getExecutionState();

	let result = $derived(executionState.result);
	let isSubmitting = $derived(executionState.isSubmitting);
	let showInitialResult = $state(true);
	let displayedResult = $derived(result ?? (showInitialResult ? initialResult : null));

	let blocklyRef = $state<BlocklyWorkspace | undefined>(undefined);
	let hintEvents = $state<HintRevealEvent[]>([]);
	let workspaceHeading = $derived(
		exercise.type === 'io' ? i18n.player_workspace_heading_io : i18n.player_workspace_heading_visual
	);
	let workspaceDescription = $derived(
		exercise.type === 'io'
			? i18n.player_workspace_description_io
			: i18n.player_workspace_description_visual
	);
	let exerciseTitle = $derived(getLocalized(exercise.content.title));

	function getBuiltinCategoryLabel(kind: 'logic' | 'loops' | 'math' | 'text' | 'variables') {
		if (kind === 'logic') return i18n.toolbox_logic;
		if (kind === 'loops') return i18n.toolbox_loops;
		if (kind === 'math') return i18n.toolbox_math;
		if (kind === 'text') return i18n.toolbox_text;
		return i18n.toolbox_variables;
	}

	function getCode(): string {
		if (!blocklyRef) return '';
		return blocklyRef.getCode();
	}

	function getWorkspaceXml(): string {
		if (!blocklyRef) return '';
		return blocklyRef.getXml();
	}

	function getWorkspaceBlockCount(workspaceXml: string): number {
		return workspaceXml.match(/<block\b/g)?.length ?? 0;
	}

	function buildBuiltinCategories(): BlocklyCategoryConfig[] {
		const makeCategory = (name: string, colour: number, ids: string[]): BlocklyCategoryConfig => ({
			kind: 'category',
			name,
			colour,
			contents: ids
				.filter((id) => exercise.config.toolbox.includes(id))
				.map((id) => ({ kind: 'block', type: id }))
		});

		const categories: BlocklyCategoryConfig[] = [];
		const logic = makeCategory(getBuiltinCategoryLabel('logic'), 210, LOGIC_BLOCKS);
		if (logic.contents.length) categories.push(logic);
		const loops = makeCategory(getBuiltinCategoryLabel('loops'), 120, LOOP_BLOCKS);
		if (loops.contents.length) categories.push(loops);
		const math = makeCategory(getBuiltinCategoryLabel('math'), 230, MATH_BLOCKS);
		if (math.contents.length) categories.push(math);
		const text = makeCategory(getBuiltinCategoryLabel('text'), 160, TEXT_BLOCKS);
		if (text.contents.length) categories.push(text);
		const variables = makeCategory(getBuiltinCategoryLabel('variables'), 330, VARIABLE_BLOCKS);
		if (variables.contents.length) categories.push(variables);

		return categories;
	}

	function getEngine() {
		if (exercise.type === 'io') {
			return null;
		}

		if (exercise.type === 'turtle') {
			const { width, height } = exercise.config.canvas;
			const engine = new Turtle(width, height);
			engine.gridSize = exercise.canvas.gridSize;
			return engine;
		}

		const width = exercise.grid.width * exercise.grid.cellSize;
		const height = exercise.grid.height * exercise.grid.cellSize;
		const engine = new Robot(width, height, {
			start: exercise.grid.start,
			direction: exercise.grid.direction
		});
		engine.gridSize = exercise.grid.cellSize;
		return engine;
	}

	function getToolbox(): BlocklyToolboxConfig {
		if (exercise.type === 'io') {
			return {
				kind: BlocklyToolboxKind.CATEGORY,
				contents: buildBuiltinCategories()
			};
		}

		const engine = getEngine();
		const prefix = exercise.type;
		const actorLabel = exercise.type === 'turtle' ? i18n.toolbox_turtle : i18n.toolbox_robot;

		const engineBlocks =
			engine?.blockDefs.filter((block) => exercise.config.toolbox.includes(block.id)) ?? [];
		const engineCategory = getCategoryForBlocks(engineBlocks, prefix, actorLabel, 160);
		const builtinCategories = buildBuiltinCategories();

		return {
			kind: BlocklyToolboxKind.CATEGORY,
			contents: [engineCategory, ...builtinCategories].filter(Boolean)
		};
	}

	function handleSubmit(result: GradingResult) {
		showInitialResult = false;
		const submissionLocale = i18n.locale === 'de' ? 'de' : 'en';
		const workspaceXml = getWorkspaceXml();
		const generatedCode = getCode();
		onSubmit({
			result,
			capture: {
				workspaceXml,
				generatedCode,
				locale: submissionLocale,
				hintEventsJson: JSON.stringify(hintEvents),
				analyticsJson: JSON.stringify({
					exerciseType: exercise.type,
					totalTests: result.totalTests,
					passedTests: result.passedTests,
					hintUsageCount: hintEvents.length,
					workspaceBlockCount: getWorkspaceBlockCount(workspaceXml),
					generatedCodeLength: generatedCode.length,
					submittedAt: Date.now()
				})
			}
		});
	}

	function handleRetry() {
		showInitialResult = false;
		executionState.handleRetry();
	}

	function handleHintEventsChange(nextEvents: HintRevealEvent[]) {
		hintEvents = [...nextEvents];
	}

	let activeTab = $state<'task' | 'blocks' | 'run'>('blocks');
</script>

<div class="flex flex-col gap-4">
	<!-- Tab bar — hidden on xl+, always visible below xl -->
	<div class="flex gap-1 rounded-lg bg-base-200 p-1 xl:hidden">
		<button
			class="btn flex-1 btn-sm"
			class:btn-primary={activeTab === 'task'}
			class:btn-ghost={activeTab !== 'task'}
			onclick={() => (activeTab = 'task')}
		>
			{i18n.player_tab_task}
		</button>
		<button
			class="btn flex-1 btn-sm"
			class:btn-primary={activeTab === 'blocks'}
			class:btn-ghost={activeTab !== 'blocks'}
			onclick={() => (activeTab = 'blocks')}
		>
			{i18n.player_tab_blocks}
		</button>
		<button
			class="btn flex-1 btn-sm"
			class:btn-primary={activeTab === 'run'}
			class:btn-ghost={activeTab !== 'run'}
			onclick={() => (activeTab = 'run')}
		>
			{i18n.player_tab_run}
		</button>
	</div>

	<div
		class="grid min-h-[70vh] gap-4 xl:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)_minmax(20rem,24rem)]"
	>
		<section
			class="min-h-0 overflow-hidden rounded-2xl border border-base-300 bg-base-100 xl:block"
			class:hidden={activeTab !== 'task'}
		>
			<div class="max-h-[28rem] overflow-y-auto p-4 xl:max-h-[70vh]">
				<ExerciseInfoPanel
					{exercise}
					{currentIndex}
					{totalExercises}
					onHintEventsChange={handleHintEventsChange}
				/>
			</div>
		</section>

		<section
			class="flex min-h-[28rem] flex-col rounded-2xl border border-base-300 bg-base-100 p-4 xl:flex"
			class:hidden={activeTab !== 'blocks'}
		>
			<div
				class="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-base-300 pb-4"
			>
				<div>
					<p class="text-xs font-medium tracking-[0.2em] text-base-content/50 uppercase">
						{currentIndex + 1}/{totalExercises}
					</p>
					<h2 class="mt-1 text-lg font-semibold">{workspaceHeading}</h2>
					<p class="mt-1 text-sm text-base-content/65">{workspaceDescription}</p>
				</div>
				<div class="badge badge-outline badge-lg">{exerciseTitle}</div>
			</div>

			<div class="min-h-[22rem] flex-1">
				{#key exercise.id}
					<BlocklyWorkspace
						bind:this={blocklyRef}
						toolboxConfig={getToolbox()}
						starterXml={initialWorkspaceXml ||
							(exercise.config.hasStarterBlocks ? exercise.config.starterXml : '')}
						ariaLabel={i18n.player_workspace_aria_label}
					/>
				{/key}
			</div>

			{#if exercise.type !== 'io'}
				<div class="mt-3">
					<CodeReadout getXml={getWorkspaceXml} refreshKey={exercise.id} />
				</div>
			{/if}
		</section>

		<section class="flex flex-col gap-4 xl:flex" class:hidden={activeTab !== 'run'}>
			<ResultsPanel
				result={displayedResult}
				{isSubmitting}
				{hasNextExercise}
				onRetry={handleRetry}
				{onNext}
			/>
			<ExecutionArea {exercise} {getCode} onSubmit={handleSubmit} />
		</section>
	</div>
</div>
