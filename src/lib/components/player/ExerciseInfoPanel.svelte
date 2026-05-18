<script lang="ts">
	import type { HintRevealEvent } from '$lib/types/attempt';
	import type { Exercise, ExerciseHint } from '$lib/types/exercise';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import { Lightbulb, ChevronRight, Clock, Eye } from '@lucide/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	type Props = {
		exercise: Exercise;
		currentIndex: number;
		totalExercises: number;
		onHintEventsChange?: (events: HintRevealEvent[]) => void;
	};

	let { exercise, currentIndex, totalExercises, onHintEventsChange }: Props = $props();

	// Hint state - use array for better reactivity in Svelte 5
	let revealedHints = $state<string[]>([]);
	let hintEvents = $state<HintRevealEvent[]>([]);
	let hintTimers = $state<SvelteMap<string, ReturnType<typeof setTimeout>>>(new SvelteMap());
	let exerciseStartTime = $state(Date.now());
	let hintClock = $state(Date.now());
	let hintClockInterval = $state<ReturnType<typeof setInterval> | null>(null);

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

	function syncHintEvents(nextEvents: HintRevealEvent[]) {
		hintEvents = nextEvents;
		revealedHints = nextEvents.map((event) => event.hintId);
		onHintEventsChange?.(nextEvents);
	}

	function recordHintReveal(hint: ExerciseHint) {
		if (revealedHints.includes(hint.id)) {
			return;
		}

		syncHintEvents([
			...hintEvents,
			{
				hintId: hint.id,
				revealedAt: Date.now(),
				trigger: hint.trigger
			}
		]);
	}

	async function handleHintClick(exercise: Exercise) {
		console.log('handleHintClick');
		if (exercise.config.hints) {
			const hasTimedHints = exercise.config.hints.some((hint) => hint.trigger === 'time');
			if (hasTimedHints) {
				hintClockInterval = setInterval(() => {
					hintClock = Date.now();
				}, 1000);
			}
			exercise.config.hints.forEach((hint) => {
				if (hint.trigger === 'time' && hint.delaySeconds) {
					const timer = setTimeout(() => {
						hintClock = Date.now();
						recordHintReveal(hint);
					}, hint.delaySeconds * 1000);
					hintTimers.set(hint.id, timer);
				}
			});
		}
	}
	$inspect(hintClockInterval);

	function clearHintTimers() {
		hintTimers.forEach((timer) => clearTimeout(timer));
		hintTimers.clear();

		if (hintClockInterval) {
			clearInterval(hintClockInterval);
			hintClockInterval = null;
		}
	}

	function initHintTimers() {
		clearHintTimers();

		if (!exercise.config.hints?.length) return;

		const hasTimedHints = exercise.config.hints.some((hint) => hint.trigger === 'time');
		if (hasTimedHints) {
			hintClockInterval = setInterval(() => {
				hintClock = Date.now();
				console.log('clock tick:', hintClock);
			}, 1000);
		}

		for (const hint of exercise.config.hints) {
			if (hint.trigger === 'time' && hint.delaySeconds != null) {
				const timer = setTimeout(() => {
					recordHintReveal(hint);
				}, hint.delaySeconds * 1000);

				hintTimers.set(hint.id, timer);
			}
		}
	}

	onMount(() => {
		initHintTimers();

		return () => {
			clearHintTimers();
		};
	});

	onDestroy(() => {
		clearHintTimers();
	});

	function revealHint(hintId: string) {
		const hint = exercise.config.hints?.find((entry) => entry.id === hintId);
		if (hint) {
			recordHintReveal(hint);
		}
	}

	function getAvailableHints(): ExerciseHint[] {
		if (!exercise.config.hints) return [];

		// For click hints, show all but only reveal content if clicked
		// For time hints, only show if time has passed
		return exercise.config.hints.filter((hint) => {
			if (revealedHints.includes(hint.id)) {
				return true;
			}

			if (hint.trigger === 'time') {
				const elapsed = (hintClock - exerciseStartTime) / 1000;
				return elapsed >= (hint.delaySeconds ?? 0);
			}
			return true; // Click hints are always shown
		});
	}

	let availableHints = $derived(getAvailableHints());
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

	<!-- Hints Section -->
	{#if exercise.config.hints && exercise.config.hints.length > 0}
		<div class="divider my-2"></div>
		<div class="space-y-2">
			<div class="flex items-center gap-2 text-sm font-medium">
				<Lightbulb class="h-4 w-4 text-warning" />
				<span>{i18n.player_hints}</span>
				<span class="text-base-content/50">
					({revealedHints.length}/{exercise.config.hints.length})
				</span>
			</div>

			{#each exercise.config.hints as hint, index (hint.id)}
				{@const isRevealed = revealedHints.includes(hint.id)}
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
								class="btn w-full justify-start gap-2 px-4 py-3 text-base btn-md btn-warning"
								onclick={() => revealHint(hint.id)}
							>
								<Lightbulb class="h-5 w-5" />
								<span>{i18n.player_reveal_hint.replace('{n}', String(index + 1))}</span>
								<ChevronRight class="ml-auto h-5 w-5" />
							</button>
						{:else}
							<div class="flex items-center gap-2 text-sm text-base-content/50">
								<Clock class="h-4 w-4" />
								<span
									>{i18n.player_hint_available_in.replace('{n}', String(hint.delaySeconds))}</span
								>
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
