<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import CoursePlayer from '$lib/components/player/CoursePlayer.svelte';
	import {
		clearGuestProgress,
		getGuestCourseProgress,
		getGuestLatestAttemptsByExercise,
		readGuestProgress,
		recordGuestAttempt,
		evaluateAndPersistGuestBadges,
		setGuestCourseResume,
		syncGuestCourseContext
	} from '$lib/guest-progress/storage';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { getPublicCourseExercises, getPublicCourses } from '$lib/remote/courses.remote';
	import type { AttemptSubmission } from '$lib/types/attempt';
	import type { CourseWithRelations as Course } from '$lib/types/course';
	import type { Exercise } from '$lib/types/exercise';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import {
		ArrowLeft,
		BookOpen,
		CheckCircle2,
		LogIn,
		Pencil,
		Play,
		RefreshCcw,
		Sparkles,
		Trash2
	} from '@lucide/svelte';
	import toast from '$lib/toaster';

	const publicCourses = getPublicCourses({});
	let publicCourseList = $derived(await publicCourses);

	let selectedCourse = $state<Course | null>(null);
	let selectedExercises = $state<Exercise[]>([]);
	let selectedCourseProgress = $state<
		Record<string, { passed: boolean; bestScore: number; attemptCount: number }>
	>({});
	let selectedSnapshots = $state<Record<string, { workspaceXml?: string }>>({});
	let selectedCourseExerciseIndex = $state(0);
	let isLoadingExercises = $state(false);
	let loadingCourseId = $state<string | null>(null);
	let guestProgress = $state(browser ? readGuestProgress() : null);

	function refreshGuestProgress() {
		if (!browser) {
			return;
		}
		guestProgress = readGuestProgress();
	}

	function getProgressForCourse(courseId: string) {
		const courseProgress = guestProgress?.courses.find((course) => course.courseId === courseId);
		return {
			completed: courseProgress?.completedCount ?? 0,
			total: courseProgress?.exerciseCount ?? 0,
			percent: courseProgress?.progress ?? 0
		};
	}

	function hydrateSelectedCourseState(courseId: string, exerciseIds: string[]) {
		const courseProgress = getGuestCourseProgress(courseId);
		selectedCourseProgress = Object.fromEntries(
			Object.values(courseProgress?.exerciseProgress ?? {}).map((progress) => [
				progress.exerciseId,
				{
					passed: progress.passed,
					bestScore: progress.bestScore,
					attemptCount: progress.attemptCount
				}
			])
		);
		selectedSnapshots = getGuestLatestAttemptsByExercise(exerciseIds);

		const firstIncompleteIndex = exerciseIds.findIndex(
			(exerciseId) => !courseProgress?.exerciseProgress?.[exerciseId]?.passed
		);
		selectedCourseExerciseIndex =
			courseProgress?.lastExerciseIndex ?? (firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0);
	}

	onMount(() => {
		refreshGuestProgress();
	});

	async function handlePlayCourse(course: Course) {
		isLoadingExercises = true;
		loadingCourseId = course.id;

		try {
			const exerciseResult = await getPublicCourseExercises(course.id).run();

			if (exerciseResult.length === 0) {
				toast.error(i18n.demo_no_published_exercises, {
					position: 'top-right'
				});
				return;
			}

			selectedCourse = course;
			selectedExercises = exerciseResult;
			const exerciseIds = exerciseResult.map((exercise) => exercise.id);
			syncGuestCourseContext(course.id, exerciseIds);
			refreshGuestProgress();
			hydrateSelectedCourseState(course.id, exerciseIds);
		} catch (error) {
			console.error('Failed to load public course:', error);
			toast.error(i18n.demo_load_failed, {
				position: 'top-right'
			});
			selectedCourse = null;
		} finally {
			isLoadingExercises = false;
			loadingCourseId = null;
		}
	}

	function handleBack() {
		selectedCourse = null;
		selectedExercises = [];
		selectedCourseProgress = {};
		selectedSnapshots = {};
		selectedCourseExerciseIndex = 0;
		refreshGuestProgress();
	}

	function handleExerciseChange(payload: { exerciseId?: string; exerciseIndex: number }) {
		if (!selectedCourse) {
			return;
		}

		setGuestCourseResume(
			selectedCourse.id,
			selectedExercises.map((exercise) => exercise.id),
			payload.exerciseIndex,
			payload.exerciseId
		);
		refreshGuestProgress();
	}

	async function persistGuestAttempt(attempt: AttemptSubmission) {
		if (!selectedCourse) {
			return;
		}

		const exerciseIds = selectedExercises.map((exercise) => exercise.id);
		recordGuestAttempt({
			courseId: selectedCourse.id,
			exerciseIds,
			exerciseIndex: Math.max(
				selectedExercises.findIndex((exercise) => exercise.id === attempt.exerciseId),
				0
			),
			attempt: {
				exerciseId: attempt.exerciseId,
				workspaceXml: attempt.workspaceXml,
				generatedCode: attempt.generatedCode,
				resultJson: attempt.resultJson,
				locale: attempt.locale,
				startedAt: attempt.startedAt,
				endedAt: attempt.endedAt,
				score: attempt.score,
				passed: attempt.passed,
				hintEventsJson: attempt.hintEventsJson,
				analyticsJson: attempt.analyticsJson
			}
		});

		const newBadges = evaluateAndPersistGuestBadges({
			courseId: selectedCourse.id,
			exerciseIds,
			attemptSignal: {
				exerciseId: attempt.exerciseId,
				passed: attempt.passed,
				score: attempt.score,
				hintEventCount: 0,
				locale: attempt.locale === 'de' ? 'de' : 'en'
			},
			hintEventsJson: attempt.hintEventsJson
		});

		refreshGuestProgress();
		hydrateSelectedCourseState(selectedCourse.id, exerciseIds);

		return { success: true, newBadges };
	}

	function handleClear() {
		clearGuestProgress();
		refreshGuestProgress();

		if (selectedCourse) {
			hydrateSelectedCourseState(
				selectedCourse.id,
				selectedExercises.map((exercise) => exercise.id)
			);
		}

		toast(i18n.demo_clear_success, { position: 'top-right' });
	}
</script>

<svelte:head>
	<title>{i18n.demo_play_as_guest} | BlockQuiz</title>
</svelte:head>

{#if selectedCourse}
	<CoursePlayer
		mode="guest"
		courseId={selectedCourse.id}
		guestCourse={selectedCourse}
		loadExercises={async (id) => (await getPublicCourseExercises(id).run()) as never}
		persistAttempt={persistGuestAttempt}
		initialProgress={selectedCourseProgress}
		initialSnapshots={selectedSnapshots}
		initialExerciseIndex={selectedCourseExerciseIndex}
		onExerciseChange={handleExerciseChange}
		onBack={handleBack}
	/>
{:else}
	<section class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
		<div
			class="flex flex-col gap-6 rounded-[2rem] border border-primary/20 bg-base-200 px-6 py-8 shadow-sm sm:px-8"
		>
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<a
					href={resolve('/login')}
					class="inline-flex w-fit items-center gap-2 rounded-full bg-base-100 px-4 py-2 text-sm font-medium text-base-content/80 shadow-sm transition hover:text-primary"
				>
					<ArrowLeft class="h-4 w-4" />
					{i18n.demo_back_login}
				</a>
				<div class="flex flex-wrap gap-2">
					<button class="btn gap-2 btn-ghost btn-sm" onclick={handleClear}>
						<Trash2 class="h-4 w-4" />
						{i18n.demo_clear_data}
					</button>
					<a href={resolve('/login')} class="btn gap-2 btn-primary btn-sm">
						<LogIn class="h-4 w-4" />
						{i18n.demo_sign_in_later}
					</a>
				</div>
			</div>

			<div class="max-w-3xl space-y-3">
				<div
					class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
				>
					<Sparkles class="h-3.5 w-3.5" />
					{i18n.demo_kicker}
				</div>
				<h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">
					{i18n.demo_play_as_guest}
				</h1>
				<p class="text-base text-base-content/70 sm:text-lg">
					{i18n.demo_intro}
				</p>
			</div>

			<div class="grid gap-3 text-sm sm:grid-cols-3">
				<div class="flex items-center gap-3 rounded-2xl bg-base-100 p-4 shadow-sm">
					<div class="rounded-xl bg-primary/10 p-2 text-primary">
						<BookOpen class="h-5 w-5" />
					</div>
					<div>
						<div class="text-xs text-base-content/60">{i18n.demo_courses_started}</div>
						<div class="text-2xl font-semibold">{guestProgress?.courses.length ?? 0}</div>
					</div>
				</div>
				<div class="flex items-center gap-3 rounded-2xl bg-base-100 p-4 shadow-sm">
					<div class="rounded-xl bg-primary/10 p-2 text-primary">
						<Pencil class="h-5 w-5" />
					</div>
					<div>
						<div class="text-xs text-base-content/60">{i18n.demo_attempts_saved}</div>
						<div class="text-2xl font-semibold">{guestProgress?.attempts.length ?? 0}</div>
					</div>
				</div>
				<div class="flex items-center gap-3 rounded-2xl bg-base-100 p-4 shadow-sm">
					<div class="rounded-xl bg-primary/10 p-2 text-primary">
						<CheckCircle2 class="h-5 w-5" />
					</div>
					<div>
						<div class="text-xs text-base-content/60">{i18n.demo_courses_completed}</div>
						<div class="text-2xl font-semibold">
							{guestProgress?.courses.filter((course) => course.progress === 100).length ?? 0}
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-semibold">{i18n.demo_public_courses}</h2>
				<p class="text-sm text-base-content/70">{i18n.demo_published_only_hint}</p>
			</div>
			<button class="btn gap-2 btn-ghost" onclick={refreshGuestProgress}>
				<RefreshCcw class="h-4 w-4" />
				{i18n.demo_refresh}
			</button>
		</div>

		{#if ((publicCourseList ?? []) as Course[]).length === 0}
			<div
				class="rounded-3xl border border-dashed border-base-300 bg-base-100 p-12 text-center text-base-content/70"
			>
				<BookOpen class="mx-auto h-10 w-10 text-base-content/40" />
				<p class="mt-4 text-lg font-medium">{i18n.demo_no_courses}</p>
			</div>
		{:else}
			<div class="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
				{#each (publicCourseList ?? []) as Course[] as course (course.id)}
					{@const progress = getProgressForCourse(course.id)}
					<article
						class="flex flex-col overflow-hidden rounded-[2rem] border border-base-300 bg-base-100 shadow-sm transition hover:shadow-md"
					>
						{#if course.content?.image}
							<img
								src={course.content.image}
								alt={i18n.courses_image_alt}
								class="h-48 w-full object-cover"
							/>
						{/if}

						<div class="flex flex-1 flex-col gap-4 p-6">
							<div class="space-y-2">
								<h3 class="text-2xl font-semibold">
									{getLocalized(course.content.title)}
								</h3>
								<div class="text-sm text-base-content/70">
									{@html sanitizeHtml(getLocalized(course.content.description))}
								</div>
							</div>

							<div class="space-y-2 rounded-2xl bg-base-200 p-4">
								<div class="flex items-center justify-between text-sm text-base-content/70">
									<span>{i18n.courses_progress}</span>
									<span>{progress.completed}/{progress.total || course.exerciseIds.length}</span>
								</div>
								<progress
									class="progress w-full progress-primary"
									value={progress.percent}
									max="100"
								></progress>
							</div>

							<div class="mt-auto flex items-center justify-between text-sm text-base-content/60">
								<span>{course.exerciseIds.length} {i18n.demo_exercises_count}</span>
							</div>

							<button
								class="btn gap-2 btn-primary"
								onclick={() => handlePlayCourse(course)}
								disabled={isLoadingExercises && loadingCourseId === course.id}
							>
								{#if isLoadingExercises && loadingCourseId === course.id}
									<span class="loading loading-xs loading-spinner"></span>
								{:else}
									<Play class="h-4 w-4" />
								{/if}
								{progress.percent > 0 ? i18n.demo_guest_continue : i18n.demo_guest_start}
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
{/if}
