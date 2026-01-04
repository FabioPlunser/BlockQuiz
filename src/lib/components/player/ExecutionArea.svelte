<script lang="ts">
	import type { Exercise } from '$lib/types/exercise';
	import type { ICanvasEngine } from '$lib/canvas/types';
	import type { GradingResult } from '$lib/player/executor';
	import { executeCode, gradeExercise } from '$lib/player/executor';
	import Canvas from '$cp/Canvas.svelte';
	import ResultsPanel from './ResultsPanel.svelte';
	import { Play, RotateCcw, Send, Square } from '@lucide/svelte';
	import { Turtle } from '$lib/canvas/Turtle.svelte';
	import { Robot } from '$lib/canvas/Robot.svelte';

	type Props = {
		exercise: Exercise;
		getCode: () => string;
		hasNextExercise: boolean;
		onSubmit: (result: GradingResult) => void;
		onNext: () => void;
	};

	let { exercise, getCode, hasNextExercise, onSubmit, onNext }: Props = $props();

	// Engine instance
	let engine = $state<ICanvasEngine | null>(null);
	let isRunning = $state(false);
	let isSubmitting = $state(false);
	let result = $state<GradingResult | null>(null);
	let executionError = $state<string | null>(null);

	// Create engine based on exercise type
	$effect(() => {
		const { width, height } = exercise.config.canvas;
		if (exercise.type === 'turtle') {
			engine = new Turtle(width, height);
		} else if (exercise.type === 'robot') {
			engine = new Robot(width, height);
		}
	});

	function handleRun() {
		if (!engine) return;
		
		isRunning = true;
		executionError = null;
		result = null;

		try {
			const code = getCode();
			if (!code.trim()) {
				executionError = 'No code to run. Add some blocks to your workspace.';
				isRunning = false;
				return;
			}

			const execResult = executeCode(code, engine);
			
			if (!execResult.success) {
				executionError = execResult.error || 'Execution failed';
			}
		} catch (err) {
			executionError = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			isRunning = false;
		}
	}

	function handleReset() {
		if (!engine) return;
		engine.reset();
		result = null;
		executionError = null;
	}

	function handleSubmit() {
		if (!engine) return;

		isSubmitting = true;
		executionError = null;

		try {
			const code = getCode();
			if (!code.trim()) {
				executionError = 'No code to submit. Add some blocks first.';
				isSubmitting = false;
				return;
			}

			// Run the code first
			const execResult = executeCode(code, engine);

			if (!execResult.success) {
				executionError = execResult.error || 'Execution failed';
				isSubmitting = false;
				return;
			}

			// Grade the result
			const gradingResult = gradeExercise(
				execResult.commands,
				exercise.config.grader.testCases,
				exercise.type
			);

			result = gradingResult;
			onSubmit(gradingResult);
		} catch (err) {
			executionError = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			isSubmitting = false;
		}
	}

	function handleRetry() {
		handleReset();
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
			<div class="mb-2 text-sm font-medium">Output</div>
			<div class="min-h-[200px] rounded bg-base-200 p-3 font-mono text-sm">
				{#if executionError}
					<span class="text-error">{executionError}</span>
				{:else}
					<span class="text-base-content/50">Run your code to see output...</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Control Buttons -->
	<div class="flex flex-wrap items-center gap-2">
		<button
			class="btn btn-primary btn-sm"
			onclick={handleRun}
			disabled={isRunning || isSubmitting}
		>
			{#if isRunning}
				<span class="loading loading-spinner loading-xs"></span>
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
			class="btn btn-success btn-sm"
			onclick={handleSubmit}
			disabled={isRunning || isSubmitting}
		>
			{#if isSubmitting}
				<span class="loading loading-spinner loading-xs"></span>
			{:else}
				<Send class="h-4 w-4" />
			{/if}
			Submit
		</button>
	</div>

	<!-- Error Display -->
	{#if executionError}
		<div class="alert alert-error">
			<span class="text-sm">{executionError}</span>
		</div>
	{/if}

	<!-- Results Panel -->
	<ResultsPanel
		{result}
		{isSubmitting}
		{hasNextExercise}
		onRetry={handleRetry}
		{onNext}
	/>
</div>

