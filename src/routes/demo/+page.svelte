<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import CoursePlayer from '$lib/components/player/CoursePlayer.svelte';
	import {
		clearGuestProgress,
		exportGuestProgress,
		getGuestCourseProgress,
		getGuestLatestAttemptsByExercise,
		importGuestProgressJson,
		readGuestProgress,
		recordGuestAttempt,
		evaluateAndPersistGuestBadges,
		setGuestCourseResume,
		syncGuestCourseContext
	} from '$lib/guest-progress/storage';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { getPublicCourseExercises, getPublicCourses } from '$lib/remote/courses.remote';
	import type { AttemptSubmission } from '$lib/types/attempt';
	import type { Course } from '$lib/types/course';
	import type { Exercise } from '$lib/types/exercise';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import {
		ArrowLeft,
		BookOpen,
		Download,
		FolderUp,
		LogIn,
		Play,
		RefreshCcw,
		Trash2
	} from '@lucide/svelte';
	import toast from '$lib/toaster';

	let publicCourses = $derived(getPublicCourses({}));

	let selectedCourse = $state<Course | null>(null);
	let selectedExercises = $state<Exercise[]>([]);
	let selectedCourseProgress = $state<
		Record<string, { passed: boolean; bestScore: number; attemptCount: number }>
	>({});
	let selectedSnapshots = $state<Record<string, { workspaceXml?: string }>>({});
	let selectedCourseExerciseIndex = $state(0);
	let isLoadingExercises = $state(false);
	let loadingCourseId = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
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
			const exerciseResult = await getPublicCourseExercises(course.id);

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

	function handleExport() {
		if (!browser) {
			return;
		}

		const blob = new Blob([exportGuestProgress()], {
			type: 'application/json'
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `blockquiz-guest-progress-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		URL.revokeObjectURL(url);
		toast.success(i18n.demo_export_success, { position: 'top-right' });
	}

	async function handleImport(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const [file] = input.files ?? [];

		if (!file) {
			return;
		}

		try {
			importGuestProgressJson(await file.text());
			refreshGuestProgress();

			if (selectedCourse) {
				hydrateSelectedCourseState(
					selectedCourse.id,
					selectedExercises.map((exercise) => exercise.id)
				);
			}

			toast.success(i18n.demo_import_success, { position: 'top-right' });
		} catch (error) {
			console.error('Failed to import guest progress:', error);
			toast.error(i18n.demo_import_failed, {
				position: 'top-right'
			});
		} finally {
			input.value = '';
		}
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
		course={selectedCourse}
		exercises={selectedExercises}
		onBack={handleBack}
		persistAttempt={persistGuestAttempt}
		initialProgress={selectedCourseProgress}
		initialSnapshots={selectedSnapshots}
		initialExerciseIndex={selectedCourseExerciseIndex}
		onExerciseChange={handleExerciseChange}
	/>
{:else}
	<section class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
		<div
			class="flex flex-col gap-4 rounded-[2rem] bg-slate-950 px-6 py-8 text-white shadow-2xl sm:px-8"
		>
			<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div class="max-w-3xl space-y-3">
					<a
						href={resolve('/login')}
						class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/20"
					>
						<ArrowLeft class="h-4 w-4" />
						{i18n.demo_back_login}
					</a>
					<h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">
						{i18n.demo_play_as_guest}
					</h1>
					<p class="max-w-2xl text-base text-white/70 sm:text-lg">
						{i18n.demo_intro}
					</p>
				</div>

				<div class="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
					<button class="btn gap-2 border-white/20 text-white btn-outline" onclick={handleExport}>
						<Download class="h-4 w-4" />
						{i18n.demo_export_json}
					</button>
					<button
						class="btn gap-2 border-white/20 text-white btn-outline"
						onclick={() => fileInput?.click()}
					>
						<FolderUp class="h-4 w-4" />
						{i18n.demo_import_json}
					</button>
					<button class="btn gap-2 border-white/20 text-white btn-outline" onclick={handleClear}>
						<Trash2 class="h-4 w-4" />
						{i18n.demo_clear_data}
					</button>
					<a href={resolve('/login')} class="btn gap-2 btn-primary">
						<LogIn class="h-4 w-4" />
						{i18n.demo_sign_in_later}
					</a>
				</div>
			</div>

			<div class="grid gap-3 text-sm text-white/80 sm:grid-cols-3">
				<div class="rounded-2xl bg-white/10 p-4">
					<div class="text-white/60">{i18n.demo_courses_started}</div>
					<div class="mt-1 text-2xl font-semibold">{guestProgress?.courses.length ?? 0}</div>
				</div>
				<div class="rounded-2xl bg-white/10 p-4">
					<div class="text-white/60">{i18n.demo_attempts_saved}</div>
					<div class="mt-1 text-2xl font-semibold">{guestProgress?.attempts.length ?? 0}</div>
				</div>
				<div class="rounded-2xl bg-white/10 p-4">
					<div class="text-white/60">{i18n.demo_courses_completed}</div>
					<div class="mt-1 text-2xl font-semibold">
						{guestProgress?.courses.filter((course) => course.progress === 100).length ?? 0}
					</div>
				</div>
			</div>
		</div>

		<input
			bind:this={fileInput}
			type="file"
			accept="application/json"
			class="hidden"
			onchange={handleImport}
		/>

		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-2xl font-semibold text-slate-900">{i18n.demo_public_courses}</h2>
				<p class="text-sm text-slate-600">{i18n.demo_published_only_hint}</p>
			</div>
			<button class="btn gap-2 btn-ghost" onclick={refreshGuestProgress}>
				<RefreshCcw class="h-4 w-4" />
				{i18n.demo_refresh}
			</button>
		</div>

		{#if publicCourses.loading}
			<div
				class="flex min-h-48 items-center justify-center rounded-3xl border border-slate-200 bg-white"
			>
				<span class="loading loading-lg loading-spinner"></span>
			</div>
		{:else if ((publicCourses.current as Course[]) ?? []).length === 0}
			<div
				class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-600"
			>
				<BookOpen class="mx-auto h-10 w-10 text-slate-400" />
				<p class="mt-4 text-lg font-medium">{i18n.demo_no_courses}</p>
			</div>
		{:else}
			<div class="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
				{#each (publicCourses.current as Course[]) ?? [] as course (course.id)}
					{@const progress = getProgressForCourse(course.id)}
					<article
						class="flex flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
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
								<h3 class="text-2xl font-semibold text-slate-900">
									{getLocalized(course.content.title)}
								</h3>
								<div class="text-sm text-slate-600">
									{@html sanitizeHtml(getLocalized(course.content.description))}
								</div>
							</div>

							<div class="space-y-2 rounded-2xl bg-slate-50 p-4">
								<div class="flex items-center justify-between text-sm text-slate-600">
									<span>{i18n.courses_progress}</span>
									<span>{progress.completed}/{progress.total || course.exerciseIds.length}</span>
								</div>
								<progress
									class="progress w-full progress-primary"
									value={progress.percent}
									max="100"
								></progress>
							</div>

							<div class="mt-auto flex items-center justify-between text-sm text-slate-500">
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
