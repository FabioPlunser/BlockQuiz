<script lang="ts">
	import type { Course } from '$types/course';

	import Boundary from '$cp/Boundary.svelte';
	import CourseEditor from './CourseEditor.svelte';
	import { CMSToolbar, CMSCardView, CMSTableView } from '$lib/components/cms';

	import { PersistedState } from 'runed';
	import { deleteCourse, getCourses } from '$lib/remote/courses.remote';
	import { fly } from 'svelte/transition';
	import { getLocalized } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';

	// --------------------------------------------------------------------
	// State
	// --------------------------------------------------------------------
	let newCourse = $state(false);
	let editCourse = $state(false);
	let selectedCourse: Course | undefined = $state(undefined);
	let searchQuery = $state('');
	let viewMode = new PersistedState<'cards' | 'table'>('coursesViewMode', 'cards');

	let courses = $derived(getCourses({}));

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
			key: 'status',
			label: 'Status',
			render: (c: Course) => (c.published ? '✓ Published' : '○ Draft')
		},
		{
			key: 'exercises',
			label: 'Exercises',
			render: (c: Course) => String(c.exerciseIds?.length ?? 0)
		},
		{
			key: 'users',
			label: 'Users',
			render: (c: Course) => String(c.userIds?.length ?? 0)
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

	async function handleDelete(course: Course) {
		if (!confirm('Are you sure you want to delete this course?')) return;

		try {
			let result = await deleteCourse(course.id).updates(courses);
			if (!result.success) {
				alert('Failed to delete course');
			}
		} catch (error) {
			console.error(error);
			alert('An error occurred while deleting the course');
		}
	}

	function handleEdit(course: Course) {
		editCourse = true;
		selectedCourse = course;
	}

	function handleCreate() {
		newCourse = true;
	}
</script>

{#snippet courseCard(course: Course)}
	<div class="card bg-base-300 shadow-xl">
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
				<button class="btn btn-sm btn-error" onclick={() => handleDelete(course)}>Delete</button>
				<button class="btn btn-sm btn-primary" onclick={() => handleEdit(course)}>Edit</button>
			</div>
		</div>
	</div>
{/snippet}

{#snippet courseActions(course: Course)}
	<div class="flex gap-1">
		<button class="btn btn-ghost btn-xs" onclick={() => handleEdit(course)} title="Edit">
			✏️
		</button>
		<button
			class="btn text-error btn-ghost btn-xs"
			onclick={() => handleDelete(course)}
			title="Delete"
		>
			🗑️
		</button>
	</div>
{/snippet}

<div class="p-4">
	<Boundary loading={courses.loading}>
		{#if !newCourse && !editCourse}
			<CMSToolbar
				bind:viewMode={viewMode.current}
				bind:searchQuery
				searchPlaceholder="Search courses..."
				createButtonLabel="Add Course"
				onCreate={handleCreate}
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
				<CMSTableView items={filteredCourses} columns={tableColumns} actions={courseActions} />
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
	</Boundary>
</div>
