<script lang="ts">
	import type { Course } from '$lib/types/course';
	import type { Exercise } from '$lib/types/exercise';
	import type { GradingResult } from '$lib/player/executor';
	import { getLocalized } from '$lib/i18n/index.svelte';
	import { submitAttempt } from '$lib/remote/courses.remote';
	import ExercisePlayer from './ExercisePlayer.svelte';
	import { Trophy, CircleCheck, ArrowLeft } from '@lucide/svelte';

	type Props = {
		course: Course;
		exercises: Exercise[];
		onBack: () => void;
	};

	let { course, exercises, onBack }: Props = $props();

	// State
	let currentExerciseIndex = $state(0);
	let exerciseResults = $state<Map<string, { passed: boolean; score: number }>>(new Map());
	let isSubmitting = $state(false);
	let showCompletionModal = $state(false);
	let startTime = $state(Date.now());

	// Derived
	let currentExercise = $derived(exercises[currentExerciseIndex]);
	let hasNextExercise = $derived(currentExerciseIndex < exercises.length - 1);
	let hasPreviousExercise = $derived(currentExerciseIndex > 0);
	let completedCount = $derived([...exerciseResults.values()].filter((r) => r.passed).length);
	let progressPercent = $derived(
		exercises.length > 0 ? Math.round((completedCount / exercises.length) * 100) : 0
	);
	let isCurrentCompleted = $derived(
		exerciseResults.get(currentExercise?.id ?? '')?.passed ?? false
	);
	let allCompleted = $derived(completedCount === exercises.length && exercises.length > 0);

	// Handle exercise submission
	async function handleSubmit(result: GradingResult) {
		if (!currentExercise) return;

		isSubmitting = true;

		try {
			// Save the result locally
			exerciseResults.set(currentExercise.id, {
				passed: result.passed,
				score: result.score
			});
			exerciseResults = new Map(exerciseResults);

			// Submit to database
			await submitAttempt({
				exerciseId: currentExercise.id,
				resultJson: JSON.stringify(result),
				score: result.score,
				passed: result.passed,
				startedAt: startTime,
				locale: 'de'
			});

			// Check if all exercises are completed
			if (result.passed && completedCount + 1 === exercises.length) {
				showCompletionModal = true;
			}
		} catch (err) {
			console.error('Failed to submit attempt:', err);
		} finally {
			isSubmitting = false;
		}
	}

	// Navigation
	function goToNext() {
		if (hasNextExercise) {
			currentExerciseIndex++;
			startTime = Date.now();
		}
	}

	function goToPrevious() {
		if (hasPreviousExercise) {
			currentExerciseIndex--;
			startTime = Date.now();
		}
	}

	function skipExercise() {
		if (hasNextExercise) {
			currentExerciseIndex++;
			startTime = Date.now();
		}
	}

	function goToExercise(index: number) {
		currentExerciseIndex = index;
		startTime = Date.now();
	}

	$inspect(exercises.length);
</script>

<!-- Modal Backdrop -->
<div class="flex w-full flex-col items-center justify-center gap-2">
	<!-- Header -->
	<div class="flex w-full items-center">
		<div>
			<button class="btn btn-ghost btn-sm" onclick={() => onBack()}>
				<ArrowLeft size="24" />
			</button>
		</div>
		<div class="flex w-full items-center justify-center">
			<div class="flex items-center justify-center gap-4">
				<h2 class="justify-center text-lg font-bold">{getLocalized(course.content?.title)}</h2>
				<div class="badge badge-primary">
					Exercise {currentExerciseIndex + 1}/{exercises.length}
				</div>
			</div>
		</div>
		<!-- Progress bar -->
		<div class="flex items-center gap-2">
			<span class="text-sm text-base-content/60">{progressPercent}%</span>
			<progress class="progress w-56 progress-primary" value={progressPercent} max="100"></progress>
		</div>
	</div>
	<!-- Exercise Dots Navigation -->
	<div class="flex items-center justify-center gap-2">
		{#each exercises as ex, i (ex.id)}
			{@const result = exerciseResults.get(ex.id)}
			<button
				class="relative h-8 w-8 cursor-pointer rounded-full transition-all {i ===
				currentExerciseIndex
					? ''
					: 'hover:scale-110'}"
				class:bg-primary={i === currentExerciseIndex}
				class:bg-success={result?.passed}
				class:bg-base-300={i !== currentExerciseIndex && !result?.passed}
				class:ring-2={i === currentExerciseIndex}
				class:ring-primary={i === currentExerciseIndex}
				onclick={() => goToExercise(i)}
				title={getLocalized(ex.content.title)}
			>
				{#if result?.passed}
					<CircleCheck
						class="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-success-content"
					/>
				{:else}
					<span
						class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-medium"
						class:text-primary-content={i === currentExerciseIndex}
						class:text-base-content={i !== currentExerciseIndex}
					>
						{i + 1}
					</span>
				{/if}
			</button>
		{/each}
	</div>
	<!-- Exercise Player -->
	<div>
		{#if currentExercise}
			{#key currentExercise.id}
				<ExercisePlayer
					exercise={currentExercise}
					currentIndex={currentExerciseIndex}
					totalExercises={exercises.length}
					onSubmit={handleSubmit}
					onNext={goToNext}
					{hasNextExercise}
				/>
			{/key}
		{:else}
			<div class="flex h-full items-center justify-center">
				<div class="text-center">
					<div class="text-4xl">📚</div>
					<div class="mt-2 text-lg font-medium">No exercises in this course</div>
					<button class="btn mt-4 btn-primary" onclick={onBack}>Close</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Course Completion Modal -->
{#if showCompletionModal}
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
		<div class="rounded-xl bg-base-100 p-8 text-center shadow-2xl">
			<div class="flex justify-center">
				<div class="flex h-20 w-20 items-center justify-center rounded-full bg-success/20">
					<Trophy class="h-10 w-10 text-success" />
				</div>
			</div>
			<h2 class="mt-4 text-2xl font-bold">Course Completed!</h2>
			<p class="mt-2 text-base-content/60">
				Congratulations! You've completed all {exercises.length} exercises.
			</p>
			<div class="mt-6 flex justify-center gap-3">
				<button class="btn btn-outline" onclick={() => (showCompletionModal = false)}>
					Review Exercises
				</button>
				<button class="btn btn-primary" onclick={onClose}> Close Course </button>
			</div>
		</div>
	</div>
{/if}
