<script lang="ts">
	import type { GradingResult } from '$lib/player/executor';
	import { CheckCircle, XCircle, AlertCircle, Trophy, RotateCcw, ArrowRight } from '@lucide/svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import { fireSuccessConfetti } from '$lib/utils/celebrate';

	type Props = {
		result: GradingResult | null;
		isSubmitting: boolean;
		hasNextExercise: boolean;
		onRetry: () => void;
		onNext: () => void;
	};

	let { result, isSubmitting, hasNextExercise, onRetry, onNext }: Props = $props();

	// Only show visible test results to students
	let visibleResults = $derived(result?.testResults.filter((t) => t.visible) ?? []);
	let hiddenCount = $derived((result?.testResults.length ?? 0) - visibleResults.length);

	let lastCelebratedId: string | null = null;
	$effect(() => {
		if (!result || !result.passed) return;
		const id = `${result.score}-${result.passedTests}-${result.totalTests}`;
		if (lastCelebratedId === id) return;
		lastCelebratedId = id;
		fireSuccessConfetti();
	});

	function progressTone(passed: boolean, passedCount: number) {
		if (passed) return 'progress-success';
		if (passedCount > 0) return 'progress-warning';
		return 'progress-error';
	}

	function formatAlmostThere(passed: number, total: number): string {
		return i18n.player_almost_there
			.replace('{passed}', String(passed))
			.replace('{total}', String(total));
	}
</script>

<div class="rounded-lg border border-base-300 bg-base-300 p-3 shadow-md">
	{#if isSubmitting}
		<!-- Loading State -->
		<div class="flex items-center justify-center gap-3 py-5">
			<span class="loading loading-sm loading-spinner"></span>
			<span class="text-sm text-base-content/60">{i18n.player_grading}</span>
		</div>
	{:else if result === null}
		<!-- No Result Yet -->
		<div class="flex items-center justify-center gap-2 py-4 text-sm text-base-content/50">
			<AlertCircle class="h-4 w-4" />
			<span>{i18n.player_submit_prompt}</span>
		</div>
	{:else}
		<!-- Result Display -->
		<div class="space-y-2.5">
			<!-- Score Header -->
			<div class="flex items-center justify-between gap-3">
				<div class="flex items-center gap-2.5">
					{#if result.passed}
						<div class="flex h-9 w-9 items-center justify-center rounded-full bg-success/20">
							<Trophy class="h-5 w-5 text-success" />
						</div>
						<div>
							<div class="text-sm leading-tight font-bold text-success">{i18n.player_excellent}</div>
							<div class="text-xs text-base-content/60">{i18n.player_all_passed}</div>
						</div>
					{:else}
						<div class="flex h-9 w-9 items-center justify-center rounded-full bg-error/20">
							<XCircle class="h-5 w-5 text-error" />
						</div>
						<div>
							<div class="text-sm leading-tight font-bold text-error">{i18n.player_not_quite}</div>
							<div class="text-xs text-base-content/60">{i18n.player_some_failed}</div>
						</div>
					{/if}
				</div>

				<!-- Score Badge -->
				<div class="text-right leading-none">
					<div
						class="text-xl font-bold"
						class:text-success={result.passed}
						class:text-error={!result.passed}
					>
						{result.score}%
					</div>
					<div class="text-xs text-base-content/50">
						{result.passedTests}/{result.totalTests}
						{i18n.player_tests}
					</div>
				</div>
			</div>

			<!-- Always-visible progress bar showing passed/total tests -->
			<progress
				class="progress h-1.5 w-full {progressTone(result.passed, result.passedTests)}"
				value={result.passedTests}
				max={result.totalTests || 1}
				aria-label={i18n.player_test_results}
			></progress>

			{#if !result.passed && result.passedTests > 0}
				<p class="text-xs text-warning-content">
					{formatAlmostThere(result.passedTests, result.totalTests)}
				</p>
			{/if}

			<!-- Test Results -->
			{#if visibleResults.length > 0}
				<div class="space-y-1.5 border-t border-base-content/10 pt-2.5">
					<div class="text-xs font-medium text-base-content/70">{i18n.player_test_results}</div>
					{#each visibleResults as test (test.id)}
						<div
							class="flex items-start gap-2 rounded-md p-1.5 {test.passed
								? 'bg-success/10'
								: 'bg-error/10'}"
						>
							{#if test.passed}
								<CheckCircle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
							{:else}
								<XCircle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
							{/if}
							<div class="flex-1">
								<div class="text-xs font-medium">{test.description}</div>
								<div class="text-xs text-base-content/60">{test.message}</div>
							</div>
						</div>
					{/each}

					{#if hiddenCount > 0}
						<div class="text-xs text-base-content/50 italic">
							+ {hiddenCount}
							{hiddenCount > 1 ? i18n.player_hidden_tests : i18n.player_hidden_test}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex gap-2 pt-1">
				<button class="btn flex-1 btn-outline btn-sm" onclick={onRetry}>
					<RotateCcw class="h-4 w-4" />
					{i18n.player_try_again}
				</button>
				{#if result.passed && hasNextExercise}
					<button class="btn flex-1 btn-sm btn-primary" onclick={onNext}>
						{i18n.player_next_exercise}
						<ArrowRight class="h-4 w-4" />
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>
