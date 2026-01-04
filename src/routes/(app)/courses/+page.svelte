<script lang="ts">
	import type { Course } from '$types/course';
	import type { Exercise } from '$lib/types/exercise';
	import Boundary from '$cp/Boundary.svelte';
	import { CMSToolbar, CMSCardView, CMSTableView } from '$lib/components/cms';
	import CoursePlayerModal from '$lib/components/player/CoursePlayerModal.svelte';
	import { PersistedState } from 'runed';
	import {
		getUserCourses,
		getCourseExercises,
		getCourseProgress
	} from '$lib/remote/courses.remote';
	import { getLocalized } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import { BookOpen, Play, CircleCheckBig } from '@lucide/svelte';
	import { Icon } from 'lineicons-svelte';

	// --------------------------------------------------------------------
	// State
	// --------------------------------------------------------------------
	let searchQuery = $state('');
	let viewMode = new PersistedState<'cards' | 'table'>('studentCoursesViewMode', 'cards');

	let courses = $derived(getUserCourses({}));

	// Modal state
	let showPlayerModal = $state(false);
	let selectedCourse = $state<Course | null>(null);
	let selectedExercises = $state<Exercise[]>([]);
	let isLoadingExercises = $state(false);
	let loadError = $state<string | null>(null);

	// Course progress cache
	let courseProgress = $state<Map<string, { completedCount: number; totalCount: number }>>(
		new Map()
	);

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
	const tableColumns = [
		{
			key: 'title',
			label: 'Title',
			render: (c: Course) => c.content?.title
		},
		{
			key: 'description',
			label: 'Description',
			render: (c: Course) => {
				const desc = getLocalized(c.content?.description);
				return desc.length > 80 ? desc.slice(0, 80) + '...' : desc;
			},
			html: true
		},
		{
			key: 'exercises',
			label: 'Exercises',
			render: (c: Course) => String(c.exerciseIds?.length ?? 0)
		},
		{
			key: 'progress',
			label: 'Progress',
			render: (c: Course) => {
				const progress = courseProgress.get(c.id);
				if (!progress) return '-';
				return `${progress.completedCount}/${progress.totalCount}`;
			}
		}
	];

	// --------------------------------------------------------------------
	// Handlers
	// --------------------------------------------------------------------
	async function handlePlayCourse(course: Course) {
		isLoadingExercises = true;
		loadError = null;
		selectedCourse = course;

		try {
			// Load exercises for this course
			const result = await getCourseExercises({ courseId: course.id });
			selectedExercises = result.current as Exercise[];

			if (selectedExercises.length === 0) {
				loadError = 'This course has no exercises yet.';
				isLoadingExercises = false;
				return;
			}

			showPlayerModal = true;
		} catch (err) {
			console.error('Failed to load exercises:', err);
			loadError = 'Failed to load course exercises. Please try again.';
		} finally {
			isLoadingExercises = false;
		}
	}

	function handleCloseModal() {
		showPlayerModal = false;
		selectedCourse = null;
		selectedExercises = [];

		// Refresh progress after playing
		loadCourseProgress();
	}

	// Load progress for all courses
	async function loadCourseProgress() {
		const allCourses = (courses.current as Course[]) ?? [];
		for (const course of allCourses) {
			try {
				const progress = await getCourseProgress({ courseId: course.id });
				if (progress.current) {
					courseProgress.set(course.id, {
						completedCount: progress.current.completedCount,
						totalCount: progress.current.exerciseCount
					});
					courseProgress = new Map(courseProgress);
				}
			} catch (err) {
				console.error('Failed to load progress for course:', course.id, err);
			}
		}
	}

	// Load progress when courses are loaded
	$effect(() => {
		if (courses.current && !courses.loading) {
			loadCourseProgress();
		}
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

<div class="p-4">
	<Boundary loading={courses.loading}>
		<div class="mb-4">
			<h1 class="text-2xl font-bold">My Courses</h1>
			<p class="text-base-content/60">Courses assigned to you</p>
		</div>

		<CMSToolbar
			bind:viewMode={viewMode.current}
			bind:searchQuery
			searchPlaceholder="Search courses..."
			showViewToggle={true}
			showSearch={true}
		/>

		{#if filteredCourses.length === 0}
			<div class="rounded-lg border-2 border-dashed border-base-300 p-12 text-center">
				<BookOpen class="mx-auto h-12 w-12 text-base-content/40" />
				<h3 class="mt-4 text-lg font-medium">No courses found</h3>
				<p class="mt-1 text-base-content/60">
					{#if searchQuery}
						No courses match your search.
					{:else}
						You haven't been assigned to any courses yet.
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

{#snippet courseCard(course: Course)}
	{@const progress = getProgressForCourse(course.id)}
	<div class="card bg-base-300 shadow-xl transition-transform hover:scale-[1.02]">
		{#if course.content?.image}
			<figure>
				<img src={course.content.image} alt="Course" class="max-h-48 w-full object-cover" />
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
						<span class="text-base-content/60">Progress</span>
						<span class="font-medium">{progress.completed}/{progress.total}</span>
					</div>
					<div class="h-2 overflow-hidden rounded-full bg-base-100">
						<div
							class="h-full transition-all duration-300"
							class:bg-success={progress.percent === 100}
							class:bg-primary={progress.percent < 100}
							style="width: {progress.percent}%"
						></div>
					</div>
				</div>
			{/if}

			<div class="mt-2 flex flex-wrap gap-1">
				{#if course.exerciseIds?.length}
					<span class="badge badge-sm badge-secondary">
						{course.exerciseIds.length} Exercises
					</span>
				{/if}
				{#if progress.percent === 100}
					<span class="badge gap-1 badge-sm badge-success">
						<CircleCheckBig class="h-3 w-3" />
						Completed
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
						<Icon name="play" class="h-4 w-4" />
					{/if}
					{progress.percent === 100 ? 'Review' : progress.percent > 0 ? 'Continue' : 'Start'}
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
		title="Play Course"
	>
		{#if isLoadingExercises && selectedCourse?.id === course.id}
			<span class="loading loading-xs loading-spinner"></span>
		{:else}
			<Play class="h-4 w-4" />
		{/if}
		Play
	</button>
{/snippet}

<!-- Error Toast -->
{#if loadError}
	<div class="toast toast-end toast-top z-50">
		<div class="alert alert-error">
			<span>{loadError}</span>
			<button class="btn btn-ghost btn-xs" onclick={() => (loadError = null)}>✕</button>
		</div>
	</div>
{/if}

<!-- Course Player Modal -->
{#if showPlayerModal && selectedCourse}
	<CoursePlayerModal
		course={selectedCourse}
		exercises={selectedExercises}
		onClose={handleCloseModal}
	/>
{/if}
