<script lang="ts">
	import type { GradingResult } from '$lib/player/executor';
	import { CheckCircle, XCircle, AlertCircle, Trophy, RotateCcw, ArrowRight } from '@lucide/svelte';
	import { i18n } from '$lib/i18n/index.svelte';

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
</script>

<div class="rounded-lg border border-base-300 bg-base-300 p-4 shadow-md">
	{#if isSubmitting}
		<!-- Loading State -->
		<div class="flex items-center justify-center gap-3 py-8">
			<span class="loading loading-md loading-spinner"></span>
			<span class="text-base-content/60">{i18n.player_grading}</span>
		</div>
	{:else if result === null}
		<!-- No Result Yet -->
		<div class="flex items-center justify-center gap-2 py-6 text-base-content/50">
			<AlertCircle class="h-5 w-5" />
			<span>{i18n.player_submit_prompt}</span>
		</div>
	{:else}
		<!-- Result Display -->
		<div class="space-y-4">
			<!-- Score Header -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					{#if result.passed}
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-success/20">
							<Trophy class="h-6 w-6 text-success" />
						</div>
						<div>
							<div class="font-bold text-success">{i18n.player_excellent}</div>
							<div class="text-sm text-base-content/60">{i18n.player_all_passed}</div>
						</div>
					{:else}
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-error/20">
							<XCircle class="h-6 w-6 text-error" />
						</div>
						<div>
							<div class="font-bold text-error">{i18n.player_not_quite}</div>
							<div class="text-sm text-base-content/60">{i18n.player_some_failed}</div>
						</div>
					{/if}
				</div>

				<!-- Score Badge -->
				<div class="text-right">
					<div
						class="text-3xl font-bold"
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

			<!-- Test Results -->
			{#if visibleResults.length > 0}
				<div class="divider my-2"></div>
				<div class="space-y-2">
					<div class="text-sm font-medium">{i18n.player_test_results}</div>
					{#each visibleResults as test (test.id)}
						<div
							class="flex items-start gap-2 rounded-lg p-2 {test.passed
								? 'bg-success/10'
								: 'bg-error/10'}"
						>
							{#if test.passed}
								<CheckCircle class="mt-0.5 h-4 w-4 shrink-0 text-success" />
							{:else}
								<XCircle class="mt-0.5 h-4 w-4 shrink-0 text-error" />
							{/if}
							<div class="flex-1">
								<div class="text-sm font-medium">{test.description}</div>
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
			<div class="flex gap-2 pt-2">
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
