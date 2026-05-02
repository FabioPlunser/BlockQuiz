<script lang="ts">
	import { browser } from '$app/environment';
	import type { Course } from '$types/course';
	import type { AttemptSubmission } from '$lib/types/attempt';
	import type { Exercise } from '$lib/types/exercise';
	import Boundary from '$cp/Boundary.svelte';
	import { CMSToolbar, CMSCardView, CMSTableView } from '$lib/components/cms';
	import CoursePlayer from '$lib/components/player/CoursePlayer.svelte';
	import { hasGuestProgress, readGuestProgress } from '$lib/guest-progress/storage';
	import { PersistedState, watch } from 'runed';
	import { onMount } from 'svelte';
	import {
		getUserCourses,
		getCourseExercises,
		getCourseProgress,
		importGuestAttempts,
		submitAttempt
	} from '$lib/remote/courses.remote';
	import { getLocalized } from '$lib/i18n/index.svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import { SvelteMap } from 'svelte/reactivity';
	import { BookOpen, Play, CircleCheckBig, Upload } from '@lucide/svelte';
	import toast from '$lib/toaster';

	// --------------------------------------------------------------------
	// State
	// --------------------------------------------------------------------
	let searchQuery = $state('');
	let viewMode = new PersistedState<'cards' | 'table'>('studentCoursesViewMode', 'cards');

	let courses = $derived(getUserCourses({}));

	// Modal state
	let selectedCourse = $state<Course | null>(null);
	let selectedExercises = $state<Exercise[]>([]);
	let selectedCourseProgress = $state<
		Record<string, { passed: boolean; bestScore: number; attemptCount: number }>
	>({});
	let selectedSnapshots = $state<Record<string, { workspaceXml?: string; resultJson?: string }>>(
		{}
	);
	let selectedCourseExerciseIndex = $state(0);
	let isLoadingExercises = $state(false);
	let hasImportableGuestState = $state(false);
	let isImportingGuestProgress = $state(false);

	// Course progress cache
	let courseProgress = new SvelteMap<string, { completedCount: number; totalCount: number }>();

	function refreshGuestState() {
		if (!browser) {
			return;
		}
		hasImportableGuestState = hasGuestProgress();
	}

	onMount(() => {
		refreshGuestState();
	});

	// --------------------------------------------------------------------
	// Filtered items
	// --------------------------------------------------------------------
	let filteredCourses = $derived.by(() => {
		const allCourses = (courses.current as Course[]) ?? [];
		if (!searchQuery.trim()) return allCourses;

		const search = searchQuery.toLowerCase();
		return allCourses.filter((course) => {
			const title =
				(course.content?.title?.de?.toLowerCase() ?? '') +
				' ' +
				(course.content?.title?.en?.toLowerCase() ?? '');
			const desc =
				(course.content?.description?.de?.toLowerCase() ?? '') +
				' ' +
				(course.content?.description?.en?.toLowerCase() ?? '');
			return title.includes(search) || desc.includes(search);
		});
	});

	// --------------------------------------------------------------------
	// Table columns
	// --------------------------------------------------------------------
	let tableColumns = $derived([
		{
			key: 'title',
			label: i18n.courses_title_label,
			render: (c: Course) => c.content?.title
		},
		{
			key: 'description',
			label: i18n.courses_description_label,
			render: (c: Course) => {
				const desc = getLocalized(c.content?.description);
				return desc.length > 80 ? desc.slice(0, 80) + '...' : desc;
			},
			html: true
		},
		{
			key: 'exercises',
			label: i18n.courses_exercises_label,
			render: (c: Course) => String(c.exerciseIds?.length ?? 0)
		},
		{
			key: 'progress',
			label: i18n.courses_progress,
			render: (c: Course) => {
				const progress = courseProgress.get(c.id);
				if (!progress) return '-';
				return `${progress.completedCount}/${progress.totalCount}`;
			}
		}
	]);

	// --------------------------------------------------------------------
	// Handlers
	// --------------------------------------------------------------------
	//
	async function handlePlayCourse(course: Course) {
		isLoadingExercises = true;
		selectedCourse = course;

		try {
			const [exerciseResult, progress] = await Promise.all([
				getCourseExercises(course.id),
				getCourseProgress({ courseId: course.id })
			]);
			selectedExercises = exerciseResult;
			selectedCourseProgress = progress.exerciseProgress ?? {};
			selectedSnapshots = progress.latestSnapshots ?? {};
			const firstIncompleteIndex = exerciseResult.findIndex(
				(exercise) => !progress.exerciseProgress?.[exercise.id]?.passed
			);
			selectedCourseExerciseIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0;

			if (selectedExercises.length === 0) {
				toast.error(i18n.courses_no_exercises_toast);
				isLoadingExercises = false;
				return;
			}
		} catch (err) {
			console.error('Failed to load exercises:', err);
			toast.error(i18n.courses_load_failed);
		} finally {
			isLoadingExercises = false;
		}
	}

	function handleBack() {
		selectedCourse = null;
		selectedExercises = [];
		selectedCourseProgress = {};
		selectedSnapshots = {};
		selectedCourseExerciseIndex = 0;

		// Refresh progress after playing
		loadCourseProgress();
	}

	async function persistAuthenticatedAttempt(attempt: AttemptSubmission) {
		return submitAttempt({
			exerciseId: attempt.exerciseId,
			workspaceXml: attempt.workspaceXml,
			generatedCode: attempt.generatedCode,
			resultJson: attempt.resultJson,
			score: attempt.score,
			passed: attempt.passed,
			startedAt: attempt.startedAt,
			endedAt: attempt.endedAt,
			locale: attempt.locale,
			hintEventsJson: attempt.hintEventsJson,
			analyticsJson: attempt.analyticsJson
		});
	}

	async function handleImportGuestProgress() {
		if (!browser) {
			return;
		}

		isImportingGuestProgress = true;
		try {
			const guestAttempts = readGuestProgress().attempts;
			const result = await importGuestAttempts({ attempts: guestAttempts });

			if (!result.success || result.importedCount === 0) {
				toast(i18n.courses_no_guest_attempts, { position: 'top-right' });
			} else {
				toast.success(i18n.courses_guest_imported, {
					position: 'top-right'
				});
			}

			await loadCourseProgress();
			refreshGuestState();
		} catch (err) {
			console.error('Failed to import guest attempts:', err);
			toast.error(i18n.courses_import_failed, {
				position: 'top-right'
			});
		} finally {
			isImportingGuestProgress = false;
		}
	}

	// Load progress for all courses
	async function loadCourseProgress() {
		const allCourses = (courses.current as Course[]) ?? [];
		for (const course of allCourses) {
			try {
				const progress = await getCourseProgress({ courseId: course.id });
				if (progress) {
					courseProgress.set(course.id, {
						completedCount: progress.completedCount,
						totalCount: progress.exerciseCount
					});
					courseProgress = new SvelteMap(courseProgress);
				}
			} catch (err) {
				console.error('Failed to load progress for course:', course.id, err);
			}
		}
	}

	// Load progress when courses are loaded
	watch([() => courses.current, () => !courses.loading], () => {
		loadCourseProgress();
	});

	function getProgressForCourse(courseId: string): {
		completed: number;
		total: number;
		percent: number;
	} {
		const progress = courseProgress.get(courseId);
		if (!progress) return { completed: 0, total: 0, percent: 0 };
		return {
			completed: progress.completedCount,
			total: progress.totalCount,
			percent:
				progress.totalCount > 0
					? Math.round((progress.completedCount / progress.totalCount) * 100)
					: 0
		};
	}
</script>

<svelte:head>
	<title>{i18n.courses_my_title} | BlockQuiz</title>
</svelte:head>

{#if !selectedCourse}
	<div class="p-4">
		<Boundary loading={courses.loading}>
			<div class="mb-4">
				<h1 class="text-2xl font-bold">{i18n.courses_my_title}</h1>
				<p class="text-base-content/60">{i18n.courses_my_subtitle}</p>
			</div>

			{#if hasImportableGuestState}
				<div
					class="mb-4 flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900 lg:flex-row lg:items-center lg:justify-between"
				>
					<div>
						<div class="font-medium">{i18n.courses_guest_progress}</div>
						<p class="text-sm text-sky-800/80">
							{i18n.courses_guest_import_hint}
						</p>
					</div>
					<button
						class="btn gap-2 btn-primary"
						onclick={handleImportGuestProgress}
						disabled={isImportingGuestProgress}
					>
						{#if isImportingGuestProgress}
							<span class="loading loading-xs loading-spinner"></span>
						{:else}
							<Upload class="h-4 w-4" />
						{/if}
						{i18n.courses_import_guest}
					</button>
				</div>
			{/if}

			<CMSToolbar
				bind:viewMode={viewMode.current}
				bind:searchQuery
				searchPlaceholder={i18n.courses_search_placeholder}
				showViewToggle={true}
				showSearch={true}
			/>

			{#if filteredCourses.length === 0}
				<div class="rounded-lg border-2 border-dashed border-base-300 p-12 text-center">
					<BookOpen class="mx-auto h-12 w-12 text-base-content/40" />
					<h3 class="mt-4 text-lg font-medium">{i18n.courses_no_found}</h3>
					<p class="mt-1 text-base-content/60">
						{#if searchQuery}
							{i18n.courses_no_match}
						{:else}
							{i18n.courses_not_assigned}
						{/if}
					</p>
				</div>
			{:else if viewMode.current === 'cards'}
				<CMSCardView items={filteredCourses} card={courseCard} gridCols={3} />
			{:else}
				<CMSTableView items={filteredCourses} columns={tableColumns} actions={courseActions} />
			{/if}
		</Boundary>
	</div>
{/if}

{#snippet courseCard(course: Course)}
	{@const progress = getProgressForCourse(course.id)}
	<div class="card bg-base-300 shadow-xl transition-transform hover:scale-[1.02]">
		{#if course.content?.image}
			<figure>
				<img
					src={course.content.image}
					alt={i18n.courses_image_alt}
					class="max-h-48 w-full object-cover"
				/>
			</figure>
		{/if}
		<div class="card-body">
			<h2 class="card-title">{getLocalized(course.content?.title)}</h2>
			<p class="text-sm text-base-content/70">
				{@html sanitizeHtml(getLocalized(course.content?.description).slice(0, 100))}
			</p>

			<!-- Progress bar -->
			{#if progress.total > 0}
				<div class="mt-2">
					<div class="mb-1 flex items-center justify-between text-xs">
						<span class="text-base-content/60">{i18n.courses_progress}</span>
						<span class="font-medium">{progress.completed}/{progress.total}</span>
					</div>
					<progress class="progress w-full progress-primary" value={progress.percent} max="100"
					></progress>
				</div>
			{/if}

			<div class="mt-2 flex flex-wrap gap-1">
				{#if course.exerciseIds?.length}
					<span class="badge badge-sm badge-accent">
						{course.exerciseIds.length}
						{i18n.courses_exercises_label}
					</span>
				{/if}
				{#if progress.percent === 100}
					<span class="badge gap-1 badge-sm badge-success">
						<CircleCheckBig class="h-3 w-3" />
						{i18n.courses_completed}
					</span>
				{/if}
			</div>

			<div class="mt-4 card-actions justify-end">
				<button
					class="btn gap-1 btn-sm btn-primary"
					onclick={() => handlePlayCourse(course)}
					disabled={isLoadingExercises && selectedCourse?.id === course.id}
				>
					{#if isLoadingExercises && selectedCourse?.id === course.id}
						<span class="loading loading-xs loading-spinner"></span>
					{:else}
						<Play />
					{/if}
					{progress.percent === 100
						? i18n.courses_review
						: progress.percent > 0
							? i18n.courses_continue
							: i18n.courses_start}
				</button>
			</div>
		</div>
	</div>
{/snippet}

{#snippet courseActions(course: Course)}
	<button
		class="btn gap-1 btn-sm btn-primary"
		onclick={() => handlePlayCourse(course)}
		disabled={isLoadingExercises && selectedCourse?.id === course.id}
	>
		{#if isLoadingExercises && selectedCourse?.id === course.id}
			<span class="loading loading-xs loading-spinner"></span>
		{:else}
			<Play class="h-4 w-4" />
		{/if}
		{i18n.courses_play}
	</button>
{/snippet}

<!-- Course Player -->
{#if selectedCourse}
	<CoursePlayer
		course={selectedCourse}
		exercises={selectedExercises}
		onBack={handleBack}
		persistAttempt={persistAuthenticatedAttempt}
		initialProgress={selectedCourseProgress}
		initialSnapshots={selectedSnapshots}
		initialExerciseIndex={selectedCourseExerciseIndex}
	/>
{/if}
