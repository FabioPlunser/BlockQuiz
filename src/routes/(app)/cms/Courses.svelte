<script lang="ts">
	import type { Course } from '$types/course';
	import type { Exercise, ExerciseFormData } from '$types/exercise';

	import Boundary from '$cp/Boundary.svelte';
	import CourseEditor from './CourseEditor.svelte';
	import ExerciseEditor from './ExerciseEditor.svelte';
	import CourseAnalytics from './CourseAnalytics.svelte';
	import { CMSToolbar, CMSCardView, CMSTableView } from '$lib/components/cms';
	import type { Column } from '$lib/components/DataTable.svelte';

	import { PersistedState } from 'runed';
	import { deleteCourse, getCourses } from '$lib/remote/courses.remote';
	import { getExercises } from '$lib/remote/exercises.remote';
	import { fly } from 'svelte/transition';
	import { getLocalized } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import { handleServerResult } from '$lib/utils/toast';
	import { BarChart3, BookOpen, Eye, Pencil, Trash2 } from '@lucide/svelte';

	// --------------------------------------------------------------------
	// State
	// --------------------------------------------------------------------
	let newCourse = $state(false);
	let editCourse = $state(false);
	let selectedCourse: Course | undefined = $state(undefined);
	let searchQuery = $state('');
	let viewMode = new PersistedState<'cards' | 'table'>('coursesViewMode', 'cards');

	// Exercise editing state
	let editExercise = $state(false);
	let selectedExercise: (Exercise & { id: string }) | undefined = $state(undefined);
	let viewingCourseExercises: Course | undefined = $state(undefined);

	// Analytics state
	let viewingAnalytics: Course | undefined = $state(undefined);

	// Column visibility state
	let visibleColumns = new PersistedState<string[]>('coursesVisibleColumns', [
		'title',
		'description',
		'status',
		'exercises',
		'users'
	]);

	let courses = $derived(getCourses({}));
	let exercises = $derived(getExercises({}));

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

	// Get exercises for the currently viewed course
	let courseExercises = $derived.by(() => {
		if (!viewingCourseExercises) return [];
		const allExercises = (exercises.current as Exercise[]) ?? [];
		const courseExerciseIds = viewingCourseExercises.exerciseIds ?? [];
		return allExercises.filter((e) => courseExerciseIds.includes(e.id));
	});

	// --------------------------------------------------------------------
	// Table columns
	// --------------------------------------------------------------------
	const tableColumns: Column<Course>[] = [
		{
			key: 'title',
			label: 'Title',
			render: (c: Course) => c.content?.title,
			sortable: true
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
			key: 'status',
			label: 'Status',
			render: (c: Course) => (c.published ? '✓ Published' : '○ Draft'),
			sortable: true
		},
		{
			key: 'exercises',
			label: 'Exercises',
			render: (c: Course) => String(c.exerciseIds?.length ?? 0),
			sortable: true
		},
		{
			key: 'users',
			label: 'Users',
			render: (c: Course) => String(c.userIds?.length ?? 0),
			sortable: true
		},
		{
			key: 'createdAt',
			label: 'Created',
			render: (c: Course) => new Date(c.createdAt).toLocaleDateString(),
			sortable: true
		}
	];

	// Filter columns by visibility
	let displayColumns = $derived.by(() => {
		return tableColumns.filter((c) => visibleColumns.current.includes(c.key));
	});

	// Exercise table columns
	const exerciseColumns: Column<Exercise>[] = [
		{
			key: 'title',
			label: 'Title',
			render: (e: Exercise) => e.content?.title
		},
		{
			key: 'type',
			label: 'Type',
			render: (e: Exercise) => e.type
		},
		{
			key: 'status',
			label: 'Status',
			render: (e: Exercise) => (e.published ? '✓ Published' : '○ Draft')
		}
	];

	// --------------------------------------------------------------------
	// Handlers
	// --------------------------------------------------------------------
	function handleCancel() {
		newCourse = false;
		editCourse = false;
		selectedCourse = undefined;
	}

	function handleExerciseCancel() {
		editExercise = false;
		selectedExercise = undefined;
		// Go back to viewing exercises if we were doing that
	}

	function handleBackFromExercises() {
		viewingCourseExercises = undefined;
		editExercise = false;
		selectedExercise = undefined;
	}

	async function handleDelete(course: Course) {
		if (!confirm('Are you sure you want to delete this course?')) return;

		try {
			let result = await deleteCourse(course.id).updates(courses);
			handleServerResult(result, 'Course deleted successfully', 'Failed to delete course');
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: 'An error occurred' },
				'',
				'An error occurred while deleting the course'
			);
		}
	}

	function handleEdit(course: Course) {
		editCourse = true;
		selectedCourse = course;
	}

	function handleCreate() {
		newCourse = true;
	}

	function handleViewExercises(course: Course) {
		viewingCourseExercises = course;
	}

	function handleViewAnalytics(course: Course) {
		viewingAnalytics = course;
	}

	function handleEditExercise(exercise: Exercise) {
		selectedExercise = exercise;
		editExercise = true;
	}

	// Convert Exercise to ExerciseFormData for the editor
	function exerciseToFormData(exercise: Exercise): ExerciseFormData & { id: string } {
		return {
			id: exercise.id,
			courseId: exercise.courseId,
			type: exercise.type,
			content: exercise.content,
			config: exercise.config,
			published: exercise.published,
			order: exercise.order
		};
	}
</script>

{#snippet courseCard(course: Course)}
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
			<div class="mt-2 flex flex-wrap gap-1">
				{#if course.exerciseIds?.length}
					<span class="badge badge-sm badge-secondary">
						{course.exerciseIds.length} Exercises
					</span>
				{/if}
				{#if course.userIds?.length}
					<span class="badge badge-sm badge-secondary">{course.userIds.length} Users</span>
				{/if}
				{#if course.published}
					<span class="badge badge-sm badge-success">Published</span>
				{:else}
					<span class="badge badge-sm badge-warning">Draft</span>
				{/if}
			</div>
			<div class="mt-4 card-actions justify-end">
				<button class="btn btn-sm btn-ghost" onclick={() => handleViewAnalytics(course)} title="Analytics">
					<BarChart3 class="h-4 w-4" />
				</button>
				<button class="btn btn-sm btn-error" onclick={() => handleDelete(course)}>Delete</button>
				<button class="btn btn-sm btn-primary" onclick={() => handleEdit(course)}>Edit</button>
			</div>
		</div>
	</div>
{/snippet}

{#snippet courseActions(course: Course)}
	<div class="flex gap-1">
		{#if course.exerciseIds?.length}
			<button
				class="btn btn-ghost btn-xs"
				onclick={() => handleViewExercises(course)}
				title="View Exercises"
			>
				<Eye class="h-3 w-3" />
			</button>
		{/if}
		<button class="btn btn-ghost btn-xs" onclick={() => handleViewAnalytics(course)} title="Analytics">
			<BarChart3 class="h-3 w-3" />
		</button>
		<button class="btn btn-ghost btn-xs" onclick={() => handleEdit(course)} title="Edit">
			<Pencil class="h-3 w-3" />
		</button>
		<button
			class="btn text-error btn-ghost btn-xs"
			onclick={() => handleDelete(course)}
			title="Delete"
		>
			<Trash2 class="h-3 w-3" />
		</button>
	</div>
{/snippet}

{#snippet exerciseActions(exercise: Exercise)}
	<div class="flex gap-1">
		<button
			class="btn btn-ghost btn-xs"
			onclick={() => handleEditExercise(exercise)}
			title="Edit Exercise"
		>
			<Pencil class="h-3 w-3" />
		</button>
	</div>
{/snippet}

<div class="p-4">
	<Boundary loading={courses.loading}>
		<!-- Analytics View -->
		{#if viewingAnalytics}
			<CourseAnalytics
				courseId={viewingAnalytics.id}
				courseTitle={getLocalized(viewingAnalytics.content?.title)}
				onBack={() => (viewingAnalytics = undefined)}
			/>
		{/if}

		<!-- Main Course List View -->
		{#if !newCourse && !editCourse && !viewingCourseExercises && !editExercise && !viewingAnalytics}
			<CMSToolbar
				bind:viewMode={viewMode.current}
				bind:searchQuery
				searchPlaceholder="Search courses..."
				createButtonLabel="Add Course"
				onCreate={handleCreate}
				showColumnPicker={true}
				columns={tableColumns}
				bind:visibleColumns={visibleColumns.current}
			/>

			{#if filteredCourses.length === 0}
				<div class="rounded-lg border-2 border-dashed border-base-300 p-12 text-center">
					<h3 class="text-lg font-medium">No courses found</h3>
					<p class="mt-1 text-base-content/60">Get started by creating your first course.</p>
					<button class="btn mt-4 btn-primary" onclick={handleCreate}>Create Course</button>
				</div>
			{:else if viewMode.current === 'cards'}
				<CMSCardView items={filteredCourses} card={courseCard} gridCols={3} />
			{:else}
				<CMSTableView items={filteredCourses} columns={displayColumns} actions={courseActions} />
			{/if}
		{/if}

		<!-- Course Editor (inline) -->
		{#if newCourse || editCourse}
			<div in:fly={{ y: -100, duration: 300 }}>
				<CourseEditor
					course={selectedCourse}
					remote={courses}
					isNew={newCourse}
					onCancel={handleCancel}
					onSave={handleCancel}
				/>
			</div>
		{/if}

		<!-- Exercise Editor (inline) -->
		{#if editExercise && selectedExercise}
			<div in:fly={{ y: -100, duration: 300 }}>
				<ExerciseEditor
					exercise={exerciseToFormData(selectedExercise)}
					remote={exercises}
					isNew={false}
					onCancel={handleExerciseCancel}
					onSave={handleExerciseCancel}
				/>
			</div>
		{/if}
	</Boundary>
</div>
