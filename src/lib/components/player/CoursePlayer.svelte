<script lang="ts">
	import type { Course } from '$lib/types/course';
	import type { Exercise } from '$lib/types/exercise';
	import type { AttemptCapture, AttemptSubmission } from '$lib/types/attempt';
	import type { GradingResult } from '$lib/player/executor';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import ExercisePlayer from './ExercisePlayer.svelte';
	import { Trophy, CircleCheck, ArrowLeft, BookOpen } from '@lucide/svelte';
	import { fireSuccessConfetti } from '$lib/utils/celebrate';
	import BadgeUnlock from './BadgeUnlock.svelte';
	import type { BadgeKey } from '$lib/achievements/rules';

	type ExerciseProgress = {
		passed: boolean;
		bestScore: number;
		attemptCount: number;
	};

	type ExerciseSnapshot = {
		workspaceXml?: string;
		resultJson?: string;
	};
	type PersistAttemptResult = {
		success?: boolean;
		grading?: GradingResult;
		newBadges?: BadgeKey[];
	} | void;

	type Props = {
		course: Course;
		exercises: Exercise[];
		onBack: () => void;
		persistAttempt: (
			attempt: AttemptSubmission
		) => Promise<PersistAttemptResult> | PersistAttemptResult;
		initialProgress?: Record<string, ExerciseProgress>;
		initialSnapshots?: Record<string, ExerciseSnapshot>;
		initialExerciseIndex?: number;
		onExerciseChange?: (payload: { exerciseId?: string; exerciseIndex: number }) => void;
	};

	let {
		course,
		exercises,
		onBack,
		persistAttempt,
		initialProgress = {},
		initialSnapshots = {},
		initialExerciseIndex,
		onExerciseChange
	}: Props = $props();

	function createExerciseResults(progress: Record<string, ExerciseProgress>) {
		return new SvelteMap(
			Object.entries(progress).map(([exerciseId, value]) => [
				exerciseId,
				{
					passed: value.passed,
					score: value.bestScore,
					attemptCount: value.attemptCount
				}
			])
		);
	}

	function getDefaultExerciseIndex() {
		if (typeof initialExerciseIndex === 'number' && initialExerciseIndex >= 0) {
			return Math.min(initialExerciseIndex, Math.max(exercises.length - 1, 0));
		}

		const firstIncompleteIndex = exercises.findIndex(
			(exercise) => !initialProgress[exercise.id]?.passed
		);
		return firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0;
	}

	function parseSnapshotResult(resultJson: string | undefined): GradingResult | null {
		if (!resultJson) return null;

		try {
			const parsed = JSON.parse(resultJson) as Partial<GradingResult>;
			if (
				typeof parsed.passed !== 'boolean' ||
				typeof parsed.score !== 'number' ||
				typeof parsed.totalTests !== 'number' ||
				typeof parsed.passedTests !== 'number' ||
				!Array.isArray(parsed.testResults)
			) {
				return null;
			}

			return parsed as GradingResult;
		} catch {
			return null;
		}
	}

	let currentExerciseIndex = $state(0);
	let exerciseResults = $state(createExerciseResults({}));
	let showCompletionModal = $state(false);
	let startTime = $state(Date.now());
	let courseStartTime = $state(Date.now());
	let totalHintsUsed = $state(0);

	function countHintEvents(hintEventsJson: string | undefined): number {
		if (!hintEventsJson) return 0;
		try {
			const parsed = JSON.parse(hintEventsJson);
			return Array.isArray(parsed) ? parsed.length : 0;
		} catch {
			return 0;
		}
	}

	function formatDuration(ms: number): string {
		const totalSeconds = Math.max(0, Math.round(ms / 1000));
		if (totalSeconds < 60) return `${totalSeconds}s`;
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
	}

	function formatTemplate(template: string, values: Record<string, string | number>): string {
		return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''));
	}

	let summaryExercises = $derived(
		[...exerciseResults.values()].filter((entry) => entry.passed).length
	);
	let summaryPerfect = $derived(
		[...exerciseResults.values()].filter((entry) => entry.passed && entry.score === 100).length
	);
	let summaryDurationMs = $state(0);
	let pendingBadges = $state<BadgeKey[]>([]);

	let currentExercise = $derived(exercises[currentExerciseIndex]);
	let hasNextExercise = $derived(currentExerciseIndex < exercises.length - 1);
	let completedCount = $derived(
		[...exerciseResults.values()].filter((result) => result.passed).length
	);
	let progressPercent = $derived(
		exercises.length > 0 ? Math.round((completedCount / exercises.length) * 100) : 0
	);
	let currentExerciseTitle = $derived(
		currentExercise ? getLocalized(currentExercise.content.title) : ''
	);
	let currentSnapshotResult = $derived(
		parseSnapshotResult(
			currentExercise ? initialSnapshots[currentExercise.id]?.resultJson : undefined
		)
	);

	$effect(() => {
		currentExerciseIndex = getDefaultExerciseIndex();
		exerciseResults = createExerciseResults(initialProgress);
	});

	$effect(() => {
		onExerciseChange?.({
			exerciseId: currentExercise?.id,
			exerciseIndex: currentExerciseIndex
		});
	});

	async function handleSubmit({
		result,
		capture
	}: {
		result: GradingResult;
		capture: AttemptCapture;
	}) {
		if (!currentExercise) return;

		try {
			const previous = exerciseResults.get(currentExercise.id);
			const endedAt = Date.now();

			const submission = {
				exerciseId: currentExercise.id,
				workspaceXml: capture.workspaceXml,
				generatedCode: capture.generatedCode,
				resultJson: JSON.stringify(result),
				locale: capture.locale,
				startedAt: startTime,
				endedAt,
				score: result.score,
				passed: result.passed,
				hintEventsJson: capture.hintEventsJson,
				analyticsJson: capture.analyticsJson
			} satisfies AttemptSubmission;

			const persisted = await persistAttempt(submission);
			const grading = persisted?.grading ?? result;

			exerciseResults.set(currentExercise.id, {
				passed: previous?.passed || grading.passed,
				score: Math.max(previous?.score ?? 0, grading.score),
				attemptCount: (previous?.attemptCount ?? 0) + 1
			});

			if (persisted?.newBadges && persisted.newBadges.length > 0) {
				pendingBadges = [...pendingBadges, ...persisted.newBadges];
			}

			totalHintsUsed += countHintEvents(capture.hintEventsJson);

			const newCompletedCount = [...exerciseResults.values()].filter(
				(entry) => entry.passed
			).length;
			if (
				!previous?.passed &&
				grading.passed &&
				newCompletedCount === exercises.length &&
				exercises.length > 0
			) {
				summaryDurationMs = Date.now() - courseStartTime;
				showCompletionModal = true;
				fireSuccessConfetti();
			}
		} catch (err) {
			console.error('Failed to submit attempt:', err);
		}
	}

	function goToNext() {
		if (!hasNextExercise) return;
		currentExerciseIndex += 1;
		startTime = Date.now();
	}

	function goToExercise(index: number) {
		currentExerciseIndex = index;
		startTime = Date.now();
	}
</script>

<div class="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
	<header class="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex items-start gap-3">
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => onBack()}
					aria-label={i18n.course_back_to_list}
				>
					<ArrowLeft size="24" />
				</button>
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-lg font-bold sm:text-xl">{getLocalized(course.content?.title)}</h1>
						<div class="badge badge-primary">
							{i18n.course_exercise_label}
							{currentExerciseIndex + 1}/{exercises.length}
						</div>
					</div>
					{#if currentExerciseTitle}
						<p class="mt-1 text-sm text-base-content/65">{currentExerciseTitle}</p>
					{/if}
				</div>
			</div>

			<div class="flex min-w-0 items-center gap-3">
				<span class="shrink-0 text-sm text-base-content/60">{progressPercent}%</span>
				<progress
					class="progress w-full min-w-32 progress-primary sm:w-56"
					value={progressPercent}
					max="100"
				></progress>
			</div>
		</div>

		<nav class="mt-4" aria-label={i18n.course_exercise_navigation}>
			<ol class="course-map flex items-center gap-1 overflow-x-auto pb-2">
				{#each exercises as exerciseItem, index (exerciseItem.id)}
					{@const result = exerciseResults.get(exerciseItem.id)}
					{@const isCurrent = index === currentExerciseIndex}
					{@const passed = !!result?.passed}
					{@const attempted = (result?.attemptCount ?? 0) > 0}
					<li class="flex items-center gap-1">
						<button
							type="button"
							class={[
								'group flex max-w-[10rem] min-w-[7rem] shrink-0 flex-col items-stretch gap-1 rounded-xl border px-2 py-2 text-left transition',
								isCurrent && 'border-primary bg-primary/10 ring-2 ring-primary/30',
								!isCurrent && passed && 'border-success bg-success/10 hover:border-success/60',
								!isCurrent &&
									attempted &&
									!passed &&
									'border-warning bg-warning/10 hover:border-warning/60',
								!isCurrent &&
									!attempted &&
									'border-base-300 bg-base-200 hover:border-base-content/20'
							]}
							onclick={() => goToExercise(index)}
							aria-current={isCurrent ? 'step' : undefined}
						>
							<div class="flex items-center justify-between gap-1">
								<span
									class="text-[10px] font-semibold tracking-wide text-base-content/55 uppercase"
								>
									#{index + 1}
								</span>
								{#if passed}
									<CircleCheck class="h-3.5 w-3.5 text-success" aria-hidden="true" />
								{:else if attempted}
									<span class="text-[10px] font-semibold text-warning-content" aria-hidden="true"
										>{result?.score ?? 0}%</span
									>
								{/if}
							</div>
							<span
								class="truncate text-xs font-medium text-base-content/85"
								title={getLocalized(exerciseItem.content.title)}
							>
								{getLocalized(exerciseItem.content.title)}
							</span>
						</button>
						{#if index < exercises.length - 1}
							<span
								aria-hidden="true"
								class={[
									'h-0.5 w-3 shrink-0 rounded-full',
									passed ? 'bg-success/60' : 'bg-base-300'
								]}
							></span>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>
	</header>

	<main class="min-w-0">
		{#if currentExercise}
			{#key currentExercise.id}
				<ExercisePlayer
					exercise={currentExercise}
					currentIndex={currentExerciseIndex}
					totalExercises={exercises.length}
					onSubmit={handleSubmit}
					onNext={goToNext}
					{hasNextExercise}
					initialWorkspaceXml={initialSnapshots[currentExercise.id]?.workspaceXml ?? ''}
					initialResult={currentSnapshotResult}
				/>
			{/key}
		{:else}
			<div
				class="flex h-full items-center justify-center rounded-2xl border border-base-300 bg-base-100 p-8"
			>
				<div class="text-center">
					<BookOpen class="mx-auto h-10 w-10 text-base-content/40" />
					<div class="mt-2 text-lg font-medium">{i18n.course_no_exercises}</div>
					<p class="mt-1 text-sm text-base-content/60">
						{i18n.course_no_exercises_friendly}
					</p>
					<button class="btn mt-4 btn-primary" onclick={onBack}>{i18n.course_close}</button>
				</div>
			</div>
		{/if}
	</main>
</div>

<BadgeUnlock badges={pendingBadges} onDismiss={() => (pendingBadges = [])} />

{#if showCompletionModal}
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
		<div class="max-w-md rounded-xl bg-base-100 p-8 text-center shadow-2xl">
			<div class="flex justify-center">
				<div class="flex h-20 w-20 items-center justify-center rounded-full bg-success/20">
					<Trophy class="h-10 w-10 text-success" />
				</div>
			</div>
			<h2 class="mt-4 text-2xl font-bold">{i18n.course_completed_title}</h2>
			<p class="mt-2 text-base-content/60">{i18n.course_completed_message}</p>

			<ul class="mt-5 space-y-1 text-sm text-base-content/80">
				<li>🎯 {formatTemplate(i18n.course_summary_exercises, { n: summaryExercises })}</li>
				{#if summaryPerfect > 0}
					<li>⭐ {formatTemplate(i18n.course_summary_perfect, { n: summaryPerfect })}</li>
				{/if}
				{#if totalHintsUsed > 0}
					<li>💡 {formatTemplate(i18n.course_summary_hints_used, { n: totalHintsUsed })}</li>
				{:else}
					<li>💡 {i18n.course_summary_no_hints}</li>
				{/if}
				{#if summaryDurationMs > 0}
					<li>
						⏱️ {formatTemplate(i18n.course_summary_total_time, {
							time: formatDuration(summaryDurationMs)
						})}
					</li>
				{/if}
			</ul>

			<div class="mt-6 flex flex-wrap justify-center gap-3">
				<button class="btn btn-outline" onclick={() => (showCompletionModal = false)}>
					{i18n.course_review}
				</button>
				<button class="btn btn-primary" onclick={onBack}>{i18n.course_close_course}</button>
			</div>
		</div>
	</div>
{/if}
