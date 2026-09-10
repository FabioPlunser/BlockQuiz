<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
	import { Play, Pause, SkipForward, RotateCcw, Rewind } from '@lucide/svelte';
	import { onDestroy } from 'svelte';
	import { getExecutionState } from './execution.svelte';

	type Props = {
		commandCount: number;
	};

	let { commandCount }: Props = $props();

	const execution = getExecutionState();

	let open = $state(false);
	let step = $state(0);
	let isPlaying = $state(false);
	let speedMs = $state(500);
	let timer: ReturnType<typeof setInterval> | null = null;

	function clearTimer() {
		if (timer !== null) {
			clearInterval(timer);
			timer = null;
		}
	}

	function applyStep(target: number) {
		const applied = execution.seekToCommand(target);
		step = applied;
	}

	function play() {
		if (commandCount === 0) return;
		if (step >= commandCount) applyStep(0);
		isPlaying = true;
		clearTimer();
		timer = setInterval(() => {
			if (step >= commandCount) {
				pause();
				return;
			}
			applyStep(step + 1);
		}, speedMs);
	}

	function pause() {
		isPlaying = false;
		clearTimer();
	}

	function stepForward() {
		pause();
		applyStep(step + 1);
	}

	function restart() {
		pause();
		applyStep(0);
	}

	function open_() {
		open = true;
		applyStep(0);
	}

	function close_() {
		pause();
		// Restore the final state so the canvas matches the run that produced
		// the trace; otherwise the learner sees the engine still mid-replay.
		applyStep(commandCount);
		open = false;
	}

	$effect(() => {
		// If speed changes while playing, restart the interval.
		if (isPlaying) {
			clearTimer();
			timer = setInterval(() => {
				if (step >= commandCount) {
					pause();
					return;
				}
				applyStep(step + 1);
			}, speedMs);
		}
	});

	onDestroy(() => clearTimer());

	function progressLabel(): string {
		return i18n.player_replay_progress
			.replace('{n}', String(step))
			.replace('{total}', String(commandCount));
	}
</script>

{#if commandCount > 0}
	<div class="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm">
		{#if !open}
			<button class="btn w-full btn-outline btn-sm" type="button" onclick={open_}>
				<Rewind class="h-4 w-4" />
				{i18n.player_replay_open}
			</button>
		{:else}
			<div class="space-y-3">
				<div>
					<div class="flex items-center justify-between gap-2">
						<h3 class="text-sm font-semibold">{i18n.player_replay_title}</h3>
						<button class="text-xs text-base-content/70 underline" type="button" onclick={close_}>
							{i18n.player_replay_close}
						</button>
					</div>
					<p class="mt-1 text-xs text-base-content/65">{i18n.player_replay_hint}</p>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					{#if isPlaying}
						<button class="btn btn-sm btn-warning" type="button" onclick={pause}>
							<Pause class="h-4 w-4" />
							{i18n.player_replay_pause}
						</button>
					{:else}
						<button
							class="btn btn-sm btn-primary"
							type="button"
							onclick={play}
							disabled={step >= commandCount}
						>
							<Play class="h-4 w-4" />
							{i18n.player_replay_play}
						</button>
					{/if}
					<button
						class="btn btn-outline btn-sm"
						type="button"
						onclick={stepForward}
						disabled={step >= commandCount}
					>
						<SkipForward class="h-4 w-4" />
						{i18n.player_replay_step}
					</button>
					<button class="btn btn-ghost btn-sm" type="button" onclick={restart}>
						<RotateCcw class="h-4 w-4" />
						{i18n.player_replay_restart}
					</button>
				</div>

				<label class="flex flex-wrap items-center gap-2 text-xs text-base-content/65">
					<span class="whitespace-nowrap">{i18n.player_replay_speed}</span>
					<input
						type="range"
						class="range flex-1 range-primary range-sm"
						min="100"
						max="1500"
						step="100"
						bind:value={speedMs}
					/>
					<span class="w-12 text-right tabular-nums">{speedMs} ms</span>
				</label>

				<div>
					<progress class="progress w-full progress-primary" value={step} max={commandCount}
					></progress>
					<div class="mt-1 flex items-center justify-between text-xs text-base-content/60">
						<span>{progressLabel()}</span>
						{#if step >= commandCount}
							<span class="text-success">{i18n.player_replay_done}</span>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
