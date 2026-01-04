<script lang="ts">
	import type { Exercise, ExerciseHint } from '$lib/types/exercise';
	import { getLocalized } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import { Lightbulb, ChevronRight, Clock, Eye, EyeOff } from '@lucide/svelte';
	import { onMount, onDestroy } from 'svelte';

	type Props = {
		exercise: Exercise;
		currentIndex: number;
		totalExercises: number;
	};

	let { exercise, currentIndex, totalExercises }: Props = $props();

	// Hint state
	let revealedHints = $state<Set<string>>(new Set());
	let hintTimers = $state<Map<string, ReturnType<typeof setTimeout>>>(new Map());
	let exerciseStartTime = $state(Date.now());

	// Reset hints when exercise changes
	$effect(() => {
		// Clear previous timers
		hintTimers.forEach((timer) => clearTimeout(timer));
		hintTimers.clear();
		revealedHints.clear();
		exerciseStartTime = Date.now();

		// Set up timed hints
		if (exercise.config.hints) {
			exercise.config.hints.forEach((hint) => {
				if (hint.trigger === 'time' && hint.delaySeconds) {
					const timer = setTimeout(() => {
						revealedHints.add(hint.id);
						revealedHints = new Set(revealedHints);
					}, hint.delaySeconds * 1000);
					hintTimers.set(hint.id, timer);
				}
			});
		}
	});

	onDestroy(() => {
		hintTimers.forEach((timer) => clearTimeout(timer));
	});

	function revealHint(hintId: string) {
		revealedHints.add(hintId);
		revealedHints = new Set(revealedHints);
	}

	function getAvailableHints(): ExerciseHint[] {
		if (!exercise.config.hints) return [];

		// For click hints, show all but only reveal content if clicked
		// For time hints, only show if time has passed
		return exercise.config.hints.filter((hint) => {
			if (hint.trigger === 'time') {
				const elapsed = (Date.now() - exerciseStartTime) / 1000;
				return elapsed >= (hint.delaySeconds ?? 0);
			}
			return true; // Click hints are always shown
		});
	}

	let availableHints = $derived(getAvailableHints());
</script>

<div class="flex h-full flex-col gap-4 overflow-y-auto bg-base-200 p-4">
	<!-- Progress Indicator -->
	<div class="flex items-center justify-between">
		<span class="text-sm font-medium text-base-content/60">
			Exercise {currentIndex + 1} of {totalExercises}
		</span>
		<div class="flex gap-1">
			{#each Array(totalExercises) as _, i}
				<div
					class="h-2 w-6 rounded-full transition-colors"
					class:bg-primary={i === currentIndex}
					class:bg-success={i < currentIndex}
					class:bg-base-300={i > currentIndex}
				></div>
			{/each}
		</div>
	</div>

	<!-- Exercise Image -->
	{#if exercise.content.image}
		<div class="overflow-hidden rounded-lg">
			<img
				src={exercise.content.image}
				alt="Exercise illustration"
				class="h-40 w-full object-cover"
			/>
		</div>
	{/if}

	<!-- Title -->
	<h2 class="text-xl font-bold">
		{getLocalized(exercise.content.title)}
	</h2>

	<!-- Description -->
	<div class="prose prose-sm max-w-none text-base-content/80">
		{@html sanitizeHtml(getLocalized(exercise.content.description))}
	</div>

	<!-- Exercise Type Badge -->
	<div class="flex gap-2">
		<span class="badge badge-outline capitalize">{exercise.type}</span>
		{#if exercise.config.mode !== 'default'}
			<span class="badge capitalize badge-secondary">{exercise.config.mode} mode</span>
		{/if}
	</div>

	<!-- Hints Section -->
	{#if exercise.config.hints && exercise.config.hints.length > 0}
		<div class="divider my-2"></div>
		<div class="space-y-2">
			<div class="flex items-center gap-2 text-sm font-medium">
				<Lightbulb class="h-4 w-4 text-warning" />
				<span>Hints</span>
				<span class="text-base-content/50">
					({revealedHints.size}/{exercise.config.hints.length})
				</span>
			</div>

			{#each exercise.config.hints as hint, index (hint.id)}
				{@const isRevealed = revealedHints.has(hint.id)}
				{@const isAvailable = availableHints.some((h) => h.id === hint.id)}

				{#if isAvailable || hint.trigger === 'click'}
					<div class="rounded-lg bg-base-300 p-3">
						{#if isRevealed}
							<div class="flex items-start gap-2">
								<Eye class="mt-0.5 h-4 w-4 shrink-0 text-warning" />
								<p class="text-sm">{getLocalized(hint.text)}</p>
							</div>
						{:else if hint.trigger === 'click'}
							<button
								class="flex w-full items-center gap-2 text-left text-sm text-base-content/60 hover:text-base-content"
								onclick={() => revealHint(hint.id)}
							>
								<EyeOff class="h-4 w-4 shrink-0" />
								<span>Click to reveal hint {index + 1}</span>
								<ChevronRight class="ml-auto h-4 w-4" />
							</button>
						{:else}
							<div class="flex items-center gap-2 text-sm text-base-content/50">
								<Clock class="h-4 w-4" />
								<span>Hint available in {hint.delaySeconds}s</span>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Spacer -->
	<div class="flex-1"></div>
</div>
