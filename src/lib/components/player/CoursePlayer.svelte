<script lang="ts">
	import type { Course } from '$lib/types/course';
	import type { Exercise } from '$lib/types/exercise';
	import type { AttemptCapture, AttemptSubmission } from '$lib/types/attempt';
	import type { GradingResult } from '$lib/player/executor';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import ExercisePlayer from './ExercisePlayer.svelte';
	import { Trophy, CircleCheck, ArrowLeft, BookOpen } from '@lucide/svelte';

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

			const newCompletedCount = [...exerciseResults.values()].filter(
				(entry) => entry.passed
			).length;
			if (
				!previous?.passed &&
				grading.passed &&
				newCompletedCount === exercises.length &&
				exercises.length > 0
			) {
				showCompletionModal = true;
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
			<div class="flex gap-2 overflow-x-auto pb-1">
				{#each exercises as exerciseItem, index (exerciseItem.id)}
					{@const result = exerciseResults.get(exerciseItem.id)}
					<button
						type="button"
						class={[
							'relative flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition',
							index === currentExerciseIndex &&
								'border-primary bg-primary text-primary-content ring-2 ring-primary/30',
							index !== currentExerciseIndex &&
								result?.passed &&
								'border-success bg-success/15 text-success',
							index !== currentExerciseIndex &&
								!result?.passed &&
								'border-base-300 bg-base-200 hover:border-base-content/20'
						]}
						onclick={() => goToExercise(index)}
						title={getLocalized(exerciseItem.content.title)}
						aria-current={index === currentExerciseIndex ? 'step' : undefined}
					>
						{#if result?.passed}
							<CircleCheck class="h-4 w-4" />
						{:else}
							<span>{index + 1}</span>
						{/if}
					</button>
				{/each}
			</div>
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
					<button class="btn mt-4 btn-primary" onclick={onBack}>{i18n.course_close}</button>
				</div>
			</div>
		{/if}
	</main>
</div>

{#if showCompletionModal}
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
		<div class="rounded-xl bg-base-100 p-8 text-center shadow-2xl">
			<div class="flex justify-center">
				<div class="flex h-20 w-20 items-center justify-center rounded-full bg-success/20">
					<Trophy class="h-10 w-10 text-success" />
				</div>
			</div>
			<h2 class="mt-4 text-2xl font-bold">{i18n.course_completed_title}</h2>
			<p class="mt-2 text-base-content/60">{i18n.course_completed_message}</p>
			<div class="mt-6 flex flex-wrap justify-center gap-3">
				<button class="btn btn-outline" onclick={() => (showCompletionModal = false)}>
					{i18n.course_review}
				</button>
				<button class="btn btn-primary" onclick={onBack}>{i18n.course_close_course}</button>
			</div>
		</div>
	</div>
{/if}
