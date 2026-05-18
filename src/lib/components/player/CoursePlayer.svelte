<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { Trophy, CircleCheck, ArrowLeft, BookOpen } from '@lucide/svelte';
	import { fireSuccessConfetti } from '$lib/utils/celebrate';
	import ExercisePlayer from './ExercisePlayer.svelte';
	import BadgeUnlock from './BadgeUnlock.svelte';
	import {
		CoursePlayerState,
		setCoursePlayer,
		type PersistAttemptFn
	} from './CoursePlayerState.svelte';
	import type { Exercise } from '$lib/types/exercise';
	import Loading from '$cp/Loading.svelte';

	type Props = {
		courseId: string;
		onBack: () => void;
		/** Switches between authed (default) and guest data paths. */
		mode?: 'student' | 'guest';
		/** Guest-only: preloaded course summary (the authed query is not callable). */
		guestCourse?: unknown;
		/** Guest-only: how to fetch the course's exercises (e.g. getPublicCourseExercises). */
		loadExercises?: (courseId: string) => Promise<Exercise[]>;
		/** Guest-only: how to persist an attempt (e.g. into localStorage). */
		persistAttempt?: PersistAttemptFn;
		/** Optional initial progress / snapshots (guest path uses these to restore state). */
		initialProgress?: Record<string, { passed: boolean; bestScore: number; attemptCount: number }>;
		initialSnapshots?: Record<string, { workspaceXml?: string; resultJson?: string }>;
		initialExerciseIndex?: number;
		onExerciseChange?: (payload: { exerciseId?: string; exerciseIndex: number }) => void;
	};
	let {
		courseId,
		onBack,
		mode = 'student',
		guestCourse,
		loadExercises,
		persistAttempt,
		initialProgress,
		initialSnapshots,
		initialExerciseIndex,
		onExerciseChange
	}: Props = $props();

	const player = new CoursePlayerState(
		untrack(() => courseId),
		{
			mode: untrack(() => mode),
			guestCourse: untrack(() => guestCourse) as never,
			loadExercises: untrack(() => loadExercises),
			persistAttempt: untrack(() => persistAttempt),
			initialProgress: untrack(() => initialProgress),
			initialSnapshots: untrack(() => initialSnapshots),
			initialExerciseIndex: untrack(() => initialExerciseIndex),
			onExerciseChange: untrack(() => onExerciseChange)
		}
	);
	setCoursePlayer(player);

	onMount(() => {
		player.init();
	});

	let lastCompletion = false;
	$effect(() => {
		if (player.showCompletionModal && !lastCompletion) {
			fireSuccessConfetti();
		}
		lastCompletion = player.showCompletionModal;
	});

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
</script>

{#if player.loading}
	<Loading />
{:else if player.error}
	<div
		class="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-8 text-center"
	>
		<div class="text-lg font-medium">{i18n.course_load_error ?? 'Failed to load course'}</div>
		<p class="text-sm text-base-content/60">{player.error.message}</p>
		<button class="btn btn-primary" onclick={onBack}>{i18n.course_close}</button>
	</div>
{:else}
	<div class="mx-auto flex w-full max-w-400 flex-col gap-4">
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
							<h1 class="text-lg font-bold sm:text-xl">
								{getLocalized(player.courseTitle)}
							</h1>
							<div class="badge badge-primary">
								{i18n.course_exercise_label}
								{player.currentExerciseIndex + 1}/{player.exercises.length}
							</div>
						</div>
						{#if player.currentExercise}
							<p class="mt-1 text-sm text-base-content/65">
								{getLocalized(player.currentExercise.content.title)}
							</p>
						{/if}
					</div>
				</div>

				<div class="flex min-w-0 items-center gap-3">
					<span class="shrink-0 text-sm text-base-content/60">{player.progressPercent}%</span>
					<progress
						class="progress w-full min-w-32 progress-primary sm:w-56"
						value={player.progressPercent}
						max="100"
					></progress>
				</div>
			</div>

			<nav class="mt-4" aria-label={i18n.course_exercise_navigation}>
				<ol class="course-map flex items-center gap-1 overflow-x-auto pb-2">
					{#each player.exercises as exerciseItem, index (exerciseItem.id)}
						{@const result = player.exerciseResults.get(exerciseItem.id)}
						{@const isCurrent = index === player.currentExerciseIndex}
						{@const passed = !!result?.passed}
						{@const attempted = (result?.attemptCount ?? 0) > 0}
						<li class="flex items-center gap-1">
							<button
								type="button"
								class={[
									'group flex max-w-40 min-w-28 shrink-0 flex-col items-stretch gap-1 rounded-xl border px-2 py-2 text-left transition',
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
								onclick={() => player.goToExercise(index)}
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
							{#if index < player.exercises.length - 1}
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
			{#if player.currentExercise}
				{#key player.currentExercise.id}
					<ExercisePlayer
						exercise={player.currentExercise}
						currentIndex={player.currentExerciseIndex}
						totalExercises={player.exercises.length}
						onSubmit={(payload) => player.handleSubmit(payload)}
						onNext={() => player.goToNext()}
						hasNextExercise={player.hasNextExercise}
						initialWorkspaceXml={player.initialSnapshots[player.currentExercise.id]?.workspaceXml ??
							''}
						initialResult={player.currentSnapshotResult}
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

	<BadgeUnlock badges={player.pendingBadges} onDismiss={() => player.dismissBadges()} />

	{#if player.showCompletionModal}
		<div class="fixed inset-0 z-1000 flex items-center justify-center bg-black/50 px-4">
			<div class="max-w-md rounded-xl bg-base-100 p-8 text-center shadow-2xl">
				<div class="flex justify-center">
					<div class="flex h-20 w-20 items-center justify-center rounded-full bg-success/20">
						<Trophy class="h-10 w-10 text-success" />
					</div>
				</div>
				<h2 class="mt-4 text-2xl font-bold">{i18n.course_completed_title}</h2>
				<p class="mt-2 text-base-content/60">{i18n.course_completed_message}</p>

				<ul class="mt-5 space-y-1 text-sm text-base-content/80">
					<li>
						🎯 {formatTemplate(i18n.course_summary_exercises, { n: player.summaryExercises })}
					</li>
					{#if player.summaryPerfect > 0}
						<li>⭐ {formatTemplate(i18n.course_summary_perfect, { n: player.summaryPerfect })}</li>
					{/if}
					{#if player.totalHintsUsed > 0}
						<li>
							💡 {formatTemplate(i18n.course_summary_hints_used, { n: player.totalHintsUsed })}
						</li>
					{:else}
						<li>💡 {i18n.course_summary_no_hints}</li>
					{/if}
					{#if player.summaryDurationMs > 0}
						<li>
							⏱️ {formatTemplate(i18n.course_summary_total_time, {
								time: formatDuration(player.summaryDurationMs)
							})}
						</li>
					{/if}
				</ul>

				<div class="mt-6 flex flex-wrap justify-center gap-3">
					<button class="btn btn-outline" onclick={() => player.closeCompletion()}>
						{i18n.course_review}
					</button>
					<button class="btn btn-primary" onclick={onBack}>{i18n.course_close_course}</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
