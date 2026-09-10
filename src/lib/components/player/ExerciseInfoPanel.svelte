<script lang="ts">
	import type { Exercise } from '$lib/types/exercise';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';

	type Props = {
		exercise: Exercise;
		currentIndex: number;
		totalExercises: number;
	};

	let { exercise, currentIndex, totalExercises }: Props = $props();

	function getExerciseTypeLabel(type: Exercise['type']) {
		if (type === 'io') return i18n.exercise_type_io;
		if (type === 'robot') return i18n.exercise_type_robot;
		return i18n.exercise_type_turtle;
	}

	function getExerciseModeLabel(mode: string) {
		if (mode === 'path') return i18n.exercise_mode_path;
		if (mode === 'apple') return i18n.exercise_mode_apple;
		return i18n.exercise_mode_default;
	}

	let exerciseTypeLabel = $derived(getExerciseTypeLabel(exercise.type));
	let exerciseModeLabel = $derived(
		exercise.config.mode === 'default' ? null : getExerciseModeLabel(exercise.config.mode)
	);
</script>

<div class="flex flex-col gap-4 overflow-y-auto rounded-xl bg-base-200 p-4 shadow-md">
	<!-- Progress Indicator -->
	<div class="flex items-center justify-between">
		<span class="text-sm font-medium text-base-content/60">
			{i18n.course_exercise_label}
			{currentIndex + 1} / {totalExercises}
		</span>
		<div class="flex gap-1">
			{#each Array.from({ length: totalExercises }, (_, index) => index) as step (step)}
				<div
					class="h-2 w-6 rounded-full transition-colors"
					class:bg-primary={step === currentIndex}
					class:bg-success={step < currentIndex}
					class:bg-gray-400={step > currentIndex}
				></div>
			{/each}
		</div>
	</div>

	<!-- Exercise Image -->
	{#if exercise.content.image}
		<div class="overflow-hidden rounded-lg">
			<img
				src={exercise.content.image}
				alt={i18n.player_exercise_image_alt}
				class="h-40 w-full object-cover"
			/>
		</div>
	{/if}

	<!-- Title -->
	<h2 class="text-xl font-bold">
		{getLocalized(exercise.content.title)}
	</h2>

	<!-- Exercise Type Badge -->
	<div class="flex gap-2">
		<span class="badge badge-outline">{exerciseTypeLabel}</span>
		{#if exerciseModeLabel}
			<span class="badge badge-secondary">{exerciseModeLabel}</span>
		{/if}
	</div>

	<!-- Description -->
	<h1 class="underline">Description:</h1>
	<div class="prose max-w-none text-base-content">
		{@html sanitizeHtml(getLocalized(exercise.content.description))}
	</div>

	<!-- Spacer -->
	<div class="flex-1"></div>
</div>
