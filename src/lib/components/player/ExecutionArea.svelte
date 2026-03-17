<script lang="ts">
	import type { Exercise } from '$lib/types/exercise';
	import type { GradingResult } from '$lib/player/executor';
	import Canvas from '$cp/Canvas.svelte';
	import { Play, RotateCcw, Send } from '@lucide/svelte';
	import { getExecutionState } from './execution.svelte';

	type Props = {
		exercise: Exercise;
		getCode: () => string;
		hasNextExercise: boolean;
		onSubmit: (result: GradingResult) => void;
		onNext: () => void;
	};

	let { exercise, getCode, hasNextExercise, onSubmit, onNext }: Props = $props();

	// Get singleton state
	const state = getExecutionState();

	// Initialize when exercise changes
	$effect(() => {
		state.initialize(exercise, getCode);
	});

	// Reactive access to state
	let engine = $derived(state.engine);
	let isRunning = $derived(state.isRunning);
	let isSubmitting = $derived(state.isSubmitting);
	let trace = $derived(state.trace);

	function handleRun() {
		state.handleRun();
	}

	function handleReset() {
		state.handleReset();
	}

	function handleSubmit() {
		state.handleSubmit(onSubmit);
	}
</script>

<div class="flex flex-col gap-4">
	<!-- Canvas Display -->
	{#if engine && (exercise.type === 'turtle' || exercise.type === 'robot')}
		<div class="flex justify-center rounded-lg border border-base-300 bg-white p-2">
			<Canvas
				{engine}
				actorType={exercise.type === 'turtle' ? 'turtle' : 'robot'}
				showGrid={true}
				gridSize={exercise.config.canvas.gridSize}
				pathOverlay={exercise.config.canvas.pathOverlay}
				targets={exercise.config.canvas.targets}
				walls={exercise.config.canvas.walls}
			/>
		</div>
	{:else if exercise.type === 'io'}
		<!-- IO Exercise - Text Input/Output -->
		<div class="rounded-lg border border-base-300 bg-base-100 p-4">
			<div class="mb-2 flex items-center justify-between text-sm font-medium">
				<span>Output</span>
				{#if exercise.io.visibleExampleInput}
					<span class="text-xs text-base-content/60">
						Example input: <code>{exercise.io.visibleExampleInput}</code>
					</span>
				{/if}
			</div>
			<pre class="min-h-32 whitespace-pre-wrap rounded-md bg-base-200 p-3 text-sm">{trace?.stdout || ''}</pre>
			{#if trace?.stderr}
				<div class="mt-3 text-sm font-medium text-error">Errors</div>
				<pre class="mt-1 whitespace-pre-wrap rounded-md bg-error/10 p-3 text-sm text-error-content">{trace.stderr}</pre>
			{/if}
		</div>
	{/if}

	<!-- Control Buttons -->
	<div class="flex flex-wrap items-center gap-2">
		<button class="btn btn-sm btn-primary" onclick={handleRun} disabled={isRunning || isSubmitting}>
			{#if isRunning}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				<Play class="h-4 w-4" />
			{/if}
			Run
		</button>

		<button
			class="btn btn-outline btn-sm"
			onclick={handleReset}
			disabled={isRunning || isSubmitting}
		>
			<RotateCcw class="h-4 w-4" />
			Reset
		</button>

		<div class="flex-1"></div>

		<button
			class="btn btn-sm btn-success"
			onclick={handleSubmit}
			disabled={isRunning || isSubmitting}
		>
			{#if isSubmitting}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				<Send class="h-4 w-4" />
			{/if}
			Submit
		</button>
	</div>
</div>
