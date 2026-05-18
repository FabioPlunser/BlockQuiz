<script lang="ts">
	import type { Course, UserCourse } from '$types/course';
	import Boundary from '$cp/Boundary.svelte';
	import { CMSToolbar, CMSCardView, CMSTableView } from '$lib/components/cms';
	import CoursePlayer from '$lib/components/player/CoursePlayer.svelte';
	import { PersistedState } from 'runed';
	import { getUserCourses } from '$lib/remote/courses.remote';
	import { getLocalized } from '$lib/i18n/index.svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import { BookOpen, Play, CircleCheckBig } from '@lucide/svelte';

	// --------------------------------------------------------------------
	// State
	// --------------------------------------------------------------------
	let searchQuery = $state('');
	let viewMode = new PersistedState<'cards' | 'table'>('studentCoursesViewMode', 'cards');

	let courseList = $derived(await getUserCourses({}));
	$inspect(courseList);

	let selectedCourse = $state<Course | null>(null);
	let isLoadingExercises = $state(false);

	// --------------------------------------------------------------------
	// Filtered items
	// --------------------------------------------------------------------
	let filteredCourses = $derived.by(() => {
		const allCourses = (courseList ?? []) as UserCourse[];
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
			render: (c: UserCourse) => c.content?.title
		},
		{
			key: 'description',
			label: i18n.courses_description_label,
			render: (c: UserCourse) => {
				const desc = getLocalized(c.content?.description);
				return desc.length > 80 ? desc.slice(0, 80) + '...' : desc;
			},
			html: true
		},
		{
			key: 'exercises',
			label: i18n.courses_exercises_label,
			render: (c: UserCourse) => String(c.numExercises)
		},
		{
			key: 'progress',
			label: i18n.courses_progress,
			render: (c: UserCourse) => {
				const progress = c.progress;
				if (!progress) return '-';
				return `${c.completedCount}/${c.numExercises}`;
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
	}

	function handleBack() {
		selectedCourse = null;
	}
</script>

<svelte:head>
	<title>{i18n.courses_my_title} | BlockQuiz</title>
</svelte:head>

{#if !selectedCourse}
	<div class="p-4">
		<Boundary>
			<div class="mb-4">
				<h1 class="text-2xl font-bold">{i18n.courses_my_title}</h1>
				<p class="text-base-content/60">{i18n.courses_my_subtitle}</p>
			</div>

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
				<CMSCardView items={filteredCourses} card={courseCard} />
			{:else}
				<CMSTableView items={filteredCourses} columns={tableColumns} actions={courseActions} />
			{/if}
		</Boundary>
	</div>
{/if}

{#snippet courseCard(course: UserCourse)}
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

			<div class="mt-2">
				<div class="mb-1 flex items-center justify-between text-xs">
					<span class="text-base-content/60">{i18n.courses_progress}</span>
					<span class="font-medium">{course.completedCount}/{course.numExercises}</span>
				</div>
				<progress class="progress w-full progress-primary" value={course.progress} max="100"
				></progress>
			</div>

			<div class="mt-2 flex flex-wrap gap-1">
				<span class="badge badge-sm badge-accent">
					{course.numExercises}
					{i18n.courses_exercises_label}
				</span>
				{#if course.progress === 100}
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
					{course.progress === 100
						? i18n.courses_review
						: course.progress > 0
							? i18n.courses_continue
							: i18n.courses_start}
				</button>
			</div>
		</div>
	</div>
{/snippet}

{#snippet courseActions(course: UserCourse)}
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
	<CoursePlayer courseId={selectedCourse.id} onBack={handleBack} />
{/if}
