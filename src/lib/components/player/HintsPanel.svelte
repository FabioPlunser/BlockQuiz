<script lang="ts">
	import type { HintRevealEvent } from '$lib/types/attempt';
	import type { Exercise, ExerciseHint } from '$lib/types/exercise';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { Lightbulb, ChevronRight, Clock, Eye } from '@lucide/svelte';
	import { onDestroy, onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	type Props = {
		exercise: Exercise;
		onHintEventsChange?: (events: HintRevealEvent[]) => void;
	};

	let { exercise, onHintEventsChange }: Props = $props();

	let revealedHints = $state<string[]>([]);
	let hintEvents = $state<HintRevealEvent[]>([]);
	let hintTimers = new SvelteMap<string, ReturnType<typeof setTimeout>>();
	let exerciseStartTime = $state(Date.now());
	let hintClock = $state(Date.now());
	let hintClockInterval: ReturnType<typeof setInterval> | null = null;

	function syncHintEvents(nextEvents: HintRevealEvent[]) {
		hintEvents = nextEvents;
		revealedHints = nextEvents.map((event) => event.hintId);
		onHintEventsChange?.(nextEvents);
	}

	function recordHintReveal(hint: ExerciseHint) {
		if (revealedHints.includes(hint.id)) return;
		syncHintEvents([
			...hintEvents,
			{ hintId: hint.id, revealedAt: Date.now(), trigger: hint.trigger }
		]);
	}

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
			}, 1000);
		}

		for (const hint of exercise.config.hints) {
			if (hint.trigger === 'time' && hint.delaySeconds != null) {
				const timer = setTimeout(() => recordHintReveal(hint), hint.delaySeconds * 1000);
				hintTimers.set(hint.id, timer);
			}
		}
	}

	onMount(() => {
		initHintTimers();
		return () => clearHintTimers();
	});
	onDestroy(() => clearHintTimers());

	function revealHint(hintId: string) {
		const hint = exercise.config.hints?.find((entry) => entry.id === hintId);
		if (hint) recordHintReveal(hint);
	}

	function getAvailableHints(): ExerciseHint[] {
		if (!exercise.config.hints) return [];
		return exercise.config.hints.filter((hint) => {
			if (revealedHints.includes(hint.id)) return true;
			if (hint.trigger === 'time') {
				const elapsed = (hintClock - exerciseStartTime) / 1000;
				return elapsed >= (hint.delaySeconds ?? 0);
			}
			return true;
		});
	}

	let availableHints = $derived(getAvailableHints());
</script>

{#if exercise.config.hints && exercise.config.hints.length > 0}
	<div class="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm">
		<div class="flex items-center gap-2 text-sm font-medium">
			<Lightbulb class="h-4 w-4 text-warning" />
			<span>{i18n.player_hints}</span>
			<span class="text-base-content/50">
				({revealedHints.length}/{exercise.config.hints.length})
			</span>
		</div>

		<div class="mt-2 space-y-2">
			{#each exercise.config.hints as hint, index (hint.id)}
				{@const isRevealed = revealedHints.includes(hint.id)}
				{@const isAvailable = availableHints.some((h) => h.id === hint.id)}

				{#if isAvailable || hint.trigger === 'click'}
					<div class="rounded-lg bg-base-200 p-3">
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
								<span>{i18n.player_hint_available_in.replace('{n}', String(hint.delaySeconds))}</span>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	</div>
{/if}
