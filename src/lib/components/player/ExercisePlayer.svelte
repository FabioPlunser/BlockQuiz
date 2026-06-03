<script lang="ts">
	import { untrack } from 'svelte';
	import { BookOpen, Blocks, Play } from '@lucide/svelte';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import type { Exercise } from '$lib/types/exercise';
	import type { AttemptCapture, HintRevealEvent } from '$lib/types/attempt';
	import type { GradingResult } from '$lib/player/executor';
	import BlocklyWorkspace from '$cp/BlocklyWorkspace.svelte';
	import ExerciseInfoPanel from './ExerciseInfoPanel.svelte';
	import HintsPanel from './HintsPanel.svelte';
	import ExecutionArea from './ExecutionArea.svelte';
	import CodeReadout from './CodeReadout.svelte';
	import GeneratedCodeView from './GeneratedCodeView.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import CollisionBanner from './CollisionBanner.svelte';
	import { ExercisePlayerState, setExercisePlayer } from './ExercisePlayerState.svelte';
	import { getToolbox } from '$lib/player/toolbox';

	const uid = $props.id();

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

	const player = new ExercisePlayerState(
		untrack(() => exercise),
		{
			initialResult: untrack(() => initialResult)
		}
	);
	setExercisePlayer(player);

	let blocklyRef = $state<BlocklyWorkspace | undefined>(undefined);
	let activeTab = $state<'task' | 'blocks' | 'run'>('blocks');
	// Bumped on every block change so the code/description views recompute live.
	let workspaceVersion = $state(0);

	let workspaceHeading = $derived(
		exercise.type === 'io' ? i18n.player_workspace_heading_io : i18n.player_workspace_heading_visual
	);
	let workspaceDescription = $derived(
		exercise.type === 'io'
			? i18n.player_workspace_description_io
			: i18n.player_workspace_description_visual
	);
	let exerciseTitle = $derived(getLocalized(exercise.content.title));
	let toolboxConfig = $derived(
		getToolbox(exercise, {
			logic: i18n.toolbox_logic,
			loops: i18n.toolbox_loops,
			math: i18n.toolbox_math,
			text: i18n.toolbox_text,
			variables: i18n.toolbox_variables,
			turtle: i18n.toolbox_turtle,
			robot: i18n.toolbox_robot,
			input: i18n.toolbox_input
		})
	);

	function getCode(): string {
		return blocklyRef?.getCode() ?? '';
	}

	function getWorkspaceXml(): string {
		return blocklyRef?.getXml() ?? '';
	}

	function handleSubmit(result: GradingResult) {
		const locale: 'de' | 'en' = i18n.locale === 'de' ? 'de' : 'en';
		const workspaceXml = getWorkspaceXml();
		const generatedCode = getCode();
		const capture = player.buildCapture({ workspaceXml, generatedCode, result, locale });
		onSubmit({ result, capture });
	}

	function handleHintEventsChange(events: HintRevealEvent[]) {
		player.handleHintEventsChange(events);
	}
</script>

<div class="flex flex-col gap-4">
	<div role="tablist" aria-label={i18n.player_workspace_aria_label} class="tabs-box tabs">
		<button
			id="{uid}-tab-task"
			role="tab"
			type="button"
			aria-selected={activeTab === 'task'}
			aria-controls="{uid}-panel-task"
			class="tab flex-1 gap-2"
			class:tab-active={activeTab === 'task'}
			onclick={() => (activeTab = 'task')}
		>
			<BookOpen size="16" aria-hidden="true" />
			<span>{i18n.player_tab_task}</span>
		</button>
		<button
			id="{uid}-tab-blocks"
			role="tab"
			type="button"
			aria-selected={activeTab === 'blocks'}
			aria-controls="{uid}-panel-blocks"
			class="tab flex-1 gap-2"
			class:tab-active={activeTab === 'blocks'}
			onclick={() => (activeTab = 'blocks')}
		>
			<Blocks size="16" aria-hidden="true" />
			<span>{i18n.player_tab_blocks}</span>
		</button>
		<button
			id="{uid}-tab-run"
			role="tab"
			type="button"
			aria-selected={activeTab === 'run'}
			aria-controls="{uid}-panel-run"
			class="tab flex-1 gap-2"
			class:tab-active={activeTab === 'run'}
			onclick={() => (activeTab = 'run')}
		>
			<Play size="16" aria-hidden="true" />
			<span>{i18n.player_tab_run}</span>
		</button>
	</div>

	<!--
		Panels stay mounted across tab switches so the Blockly workspace keeps
		the learner's in-progress blocks. Toggle visibility via `hidden` instead
		of `{#if}` to avoid unmount/remount of expensive children.
	-->
	<div
		id="{uid}-panel-task"
		role="tabpanel"
		aria-labelledby="{uid}-tab-task"
		hidden={activeTab !== 'task'}
		class="min-h-0 overflow-hidden rounded-2xl border border-base-300 bg-base-100"
	>
		<div class="min-h-0 overflow-y-auto p-4">
			<ExerciseInfoPanel {exercise} {currentIndex} {totalExercises} />
		</div>
	</div>

	<div
		id="{uid}-panel-blocks"
		role="tabpanel"
		aria-labelledby="{uid}-tab-blocks"
		hidden={activeTab !== 'blocks'}
		class="flex min-h-[36rem] flex-col rounded-2xl border border-base-300 bg-base-100 p-4"
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

		{#if exercise.config.hints && exercise.config.hints.length > 0}
			<div class="mb-4">
				<HintsPanel {exercise} onHintEventsChange={handleHintEventsChange} />
			</div>
		{/if}

		<div class="flex min-h-[28rem] flex-1 flex-col">
			{#key `${exercise.id}-${i18n.locale}`}
				<BlocklyWorkspace
					bind:this={blocklyRef}
					{toolboxConfig}
					starterXml={initialWorkspaceXml ||
						(exercise.config.hasStarterBlocks ? exercise.config.starterXml : '')}
					ariaLabel={i18n.player_workspace_aria_label}
					onChange={() => workspaceVersion++}
				/>
			{/key}
		</div>

		{#if exercise.type !== 'io'}
			<div class="mt-3">
				<CodeReadout getXml={getWorkspaceXml} refreshKey={`${exercise.id}:${workspaceVersion}`} />
			</div>
		{/if}
		<div class="mt-3">
			<GeneratedCodeView {getCode} refreshKey={`${exercise.id}:${workspaceVersion}`} />
		</div>
	</div>

	<div
		id="{uid}-panel-run"
		role="tabpanel"
		aria-labelledby="{uid}-tab-run"
		hidden={activeTab !== 'run'}
		class="flex flex-col gap-4"
	>
		{#if player.collision}
			<CollisionBanner onRetry={() => player.handleRetry()} />
		{/if}
		<ResultsPanel
			result={player.displayedResult}
			isSubmitting={player.isSubmitting}
			{hasNextExercise}
			onRetry={() => player.handleRetry()}
			{onNext}
		/>
		<ExecutionArea {exercise} {getCode} onSubmit={handleSubmit} />
	</div>
</div>
