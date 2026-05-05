<script lang="ts">
	import type { Exercise } from '$lib/types/exercise';
	import type { GradingResult } from '$lib/player/executor';
	import Canvas from '$cp/Canvas.svelte';
	import { Play, RotateCcw, Send } from '@lucide/svelte';
	import { getExecutionState } from './execution.svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import Replay from './Replay.svelte';

	type Props = {
		exercise: Exercise;
		getCode: () => string;
		onSubmit: (result: GradingResult) => void;
	};

	let { exercise, getCode, onSubmit }: Props = $props();

	// Get singleton state
	const execution = getExecutionState();

	// Initialize when exercise changes
	$effect(() => {
		execution.initialize(exercise, getCode);
	});

	// Reactive access to state
	let engine = $derived(execution.engine);
	let isRunning = $derived(execution.isRunning);
	let isSubmitting = $derived(execution.isSubmitting);
	let trace = $derived(execution.trace);
	let commandCount = $derived(execution.commandCount);
	let runLabel = $derived(i18n.player_try);
	let submitLabel = $derived(i18n.player_check_answer);
	let outputLabel = $derived(i18n.player_io_output_label);
	let runHint = $derived(
		exercise.type === 'io' ? i18n.player_io_run_hint : i18n.player_visual_run_hint
	);
	let exampleInputLabel = $derived(i18n.player_io_example_input_label);
	let exampleOutputLabel = $derived(i18n.player_io_example_output_label);
	let emptyOutputMessage = $derived(i18n.player_io_empty_output);

	function handleRun() {
		execution.handleRun();
	}

	function handleReset() {
		execution.handleReset();
	}

	function handleSubmit() {
		execution.handleSubmit(onSubmit);
	}

	let showStderrDetails = $state(false);
</script>

<div class="flex flex-col gap-4">
	{#if engine && (exercise.type === 'turtle' || exercise.type === 'robot')}
		<div class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
			<div class="mb-3">
				<h3 class="text-base font-semibold">{runLabel}</h3>
				<p class="mt-1 text-sm text-base-content/65">{runHint}</p>
			</div>
			<div class="flex justify-center rounded-xl border border-base-300 bg-white p-2">
				<Canvas
					{engine}
					actorType={exercise.type === 'turtle' ? 'turtle' : 'robot'}
					showGrid={true}
					gridSize={exercise.type === 'turtle' ? exercise.canvas.gridSize : exercise.grid.cellSize}
					pathOverlay={exercise.type === 'turtle' ? exercise.canvas.pathOverlay : []}
					targets={exercise.type === 'turtle' ? exercise.canvas.targets : exercise.grid.targets}
					walls={exercise.type === 'turtle' ? exercise.canvas.walls : exercise.grid.walls}
				/>
			</div>
		</div>

		<Replay {commandCount} />
	{:else if exercise.type === 'io'}
		<div class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
			<div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h3 class="text-base font-semibold">{outputLabel}</h3>
					<p class="mt-1 text-sm text-base-content/65">{runHint}</p>
				</div>
				{#if exercise.io.visibleExampleInput}
					<div class="rounded-lg bg-base-200 px-3 py-2 text-xs text-base-content/70">
						<div class="font-medium">{exampleInputLabel}</div>
						<code class="mt-1 block whitespace-pre-wrap">{exercise.io.visibleExampleInput}</code>
					</div>
				{/if}
			</div>

			{#if exercise.io.visibleExampleOutput}
				<div class="mb-3 rounded-xl bg-base-200 p-3">
					<div class="text-xs font-medium text-base-content/60">{exampleOutputLabel}</div>
					<pre class="mt-1 text-sm whitespace-pre-wrap">{exercise.io.visibleExampleOutput}</pre>
				</div>
			{/if}

			<div class="rounded-xl bg-base-200 p-3">
				<pre class="min-h-32 text-sm whitespace-pre-wrap" aria-live="polite">{trace?.stdout ||
						emptyOutputMessage}</pre>
			</div>

			{#if trace?.stderr}
				<div class="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3">
					<div class="flex items-start gap-2">
						<span aria-hidden="true" class="text-lg">🤔</span>
						<div class="flex-1">
							<div class="font-semibold text-warning-content">
								{i18n.player_io_error_friendly_title}
							</div>
							<p class="mt-1 text-sm text-base-content/80">
								{i18n.player_io_error_friendly_hint}
							</p>
							<button
								type="button"
								class="mt-2 text-xs text-base-content/70 underline hover:text-base-content"
								onclick={() => (showStderrDetails = !showStderrDetails)}
							>
								{showStderrDetails
									? i18n.player_io_error_hide_details
									: i18n.player_io_error_show_details}
							</button>
							{#if showStderrDetails}
								<pre
									class="mt-2 rounded-md bg-base-200 p-2 text-xs whitespace-pre-wrap text-base-content/80">{trace.stderr}</pre>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
		<button
			class="btn w-full btn-primary sm:w-auto"
			onclick={handleRun}
			disabled={isRunning || isSubmitting}
		>
			{#if isRunning}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				<Play class="h-4 w-4" />
			{/if}
			{runLabel}
		</button>

		<button
			class="btn w-full btn-outline sm:w-auto"
			onclick={handleReset}
			disabled={isRunning || isSubmitting}
		>
			<RotateCcw class="h-4 w-4" />
			{i18n.player_reset}
		</button>

		<div class="hidden flex-1 sm:block"></div>

		<button
			class="btn w-full btn-success sm:w-auto"
			onclick={handleSubmit}
			disabled={isRunning || isSubmitting}
		>
			{#if isSubmitting}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				<Send class="h-4 w-4" />
			{/if}
			{submitLabel}
		</button>
	</div>
</div>
