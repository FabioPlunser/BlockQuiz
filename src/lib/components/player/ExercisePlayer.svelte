<script lang="ts">
	import { untrack } from 'svelte';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import type { Exercise } from '$lib/types/exercise';
	import type { AttemptCapture, HintRevealEvent } from '$lib/types/attempt';
	import type { GradingResult } from '$lib/player/executor';
	import BlocklyWorkspace from '$cp/BlocklyWorkspace.svelte';
	import ExerciseInfoPanel from './ExerciseInfoPanel.svelte';
	import ExecutionArea from './ExecutionArea.svelte';
	import CodeReadout from './CodeReadout.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import CollisionBanner from './CollisionBanner.svelte';
	import { ExercisePlayerState, setExercisePlayer } from './ExercisePlayerState.svelte';
	import { getToolbox } from '$lib/player/toolbox';

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
			robot: i18n.toolbox_robot
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

<div class="@container/player flex flex-col gap-4">
	<!-- Tab bar: shown only when container is narrow enough that even a vertical stack is too cramped. -->
	<div class="flex gap-1 rounded-lg bg-base-200 p-1 @md/player:hidden">
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

	<!--
		Layout tiers driven by the container's width (so embeds in narrower
		columns like the CMS preview pick the right layout, regardless of viewport):
		  • narrow  (default)         → tab bar above, single panel below
		  • medium  (@md/player)      → all three panels stacked vertically, full width
		  • wide    (@4xl/player ~56rem) → three-column grid
	-->
	<div
		class="grid min-h-[60vh] gap-4 @4xl/player:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)_minmax(20rem,24rem)]"
	>
		<section
			class="min-h-0 overflow-hidden rounded-2xl border border-base-300 bg-base-100 @md/player:block"
			class:hidden={activeTab !== 'task'}
		>
			<div class="max-h-[28rem] overflow-y-auto p-4 @4xl/player:max-h-[70vh]">
				<ExerciseInfoPanel
					{exercise}
					{currentIndex}
					{totalExercises}
					onHintEventsChange={handleHintEventsChange}
				/>
			</div>
		</section>

		<section
			class="flex min-h-[36rem] flex-col rounded-2xl border border-base-300 bg-base-100 p-4 @md/player:flex"
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

			<div class="flex min-h-[28rem] flex-1 flex-col">
				{#key `${exercise.id}-${i18n.locale}`}
					<BlocklyWorkspace
						bind:this={blocklyRef}
						{toolboxConfig}
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

		<section class="flex flex-col gap-4 @md/player:flex" class:hidden={activeTab !== 'run'}>
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
		</section>
	</div>
</div>
