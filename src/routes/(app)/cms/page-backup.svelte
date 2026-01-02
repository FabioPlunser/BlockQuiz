<script lang="ts">
	import Icon from '@iconify/svelte';
	import { PersistedState } from 'runed';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Components
	import TurtleCanvas from '$cp/TurtleCanvas.svelte';
	import ExerciseEditor from '$lib/components/ExerciseEditor.svelte';

	// Remote functions
	import {
		getExercises,
		getExercise,
		createExercise,
		updateExercise,
		deleteExercise,
		publishExercise,
		unpublishExercise
	} from '$lib/remote/exercises.remote';

	// Types
	import type { ExerciseFormData, ExerciseContent, ExerciseConfig } from '$lib/types/exercise';
	import { createDefaultExerciseFormData } from '$lib/types/exercise';
	import Courses from './Courses.svelte';

	// --------------------------------------------------------------------------------
	// URL State
	// --------------------------------------------------------------------------------
	let searchParams = $derived(page.url.searchParams);

	let courseId = $derived(searchParams.get('courseId'));
	let exerciseId = $derived(searchParams.get('exerciseId'));
	let isNewExercise = $derived(searchParams.get('new') === 'exercise');

	// --------------------------------------------------------------------------------
	// Persisted UI State
	// --------------------------------------------------------------------------------
	const possiblePages = ['Courses', 'Exercises'];
	const currentPage = new PersistedState('Pages', 'Courses');
	const currentView = new PersistedState('UserView', 'Cards');

	// --------------------------------------------------------------------------------
	// Temp Course Data (TODO: replace with real data)
	// --------------------------------------------------------------------------------
	const tempCourses = [
		{ id: '1', name: 'Course 1', description: 'Description 1', exercises: 10 },
		{ id: '2', name: 'Course 2', description: 'Description 2', exercises: 20 },
		{ id: '3', name: 'Course 3', description: 'Description 3', exercises: 30 },
		{ id: '4', name: 'Course 4', description: 'Description 4', exercises: 40 },
		{ id: '5', name: 'Course 5', description: 'Description 5', exercises: 50 },
		{ id: '6', name: 'Course 6', description: 'Description 6', exercises: 60 },
		{ id: '7', name: 'Course 7', description: 'Description 7', exercises: 70 },
		{ id: '8', name: 'Course 8', description: 'Description 8', exercises: 80 },
		{ id: '9', name: 'Course 9', description: 'Description 9', exercises: 90 },
		{ id: '10', name: 'Course 10', description: 'Description 10', exercises: 100 }
	];

	let turtleRef: TurtleCanvas;

	// --------------------------------------------------------------------------------
	// Exercise List State
	// --------------------------------------------------------------------------------
	interface ExerciseListItem {
		id: string;
		courseId: string;
		type: string;
		content: ExerciseContent;
		published: boolean;
		order: number;
		createdAt: number;
		updatedAt: number;
	}

	let exercises = $state<ExerciseListItem[]>([]);
	let isLoadingExercises = $state(false);
	let exercisesError = $state<string | null>(null);

	// Filter state
	let filterType = $state<string>('');
	let filterPublished = $state<string>('');

	async function loadExercises() {
		isLoadingExercises = true;
		exercisesError = null;

		try {
			const filters: { type?: 'io' | 'turtle' | 'robot'; published?: boolean } = {};
			if (filterType) filters.type = filterType as 'io' | 'turtle' | 'robot';
			if (filterPublished === 'true') filters.published = true;
			if (filterPublished === 'false') filters.published = false;

			const data = await getExercises(filters);
			exercises = (data ?? []) as ExerciseListItem[];
		} catch (e) {
			exercisesError = e instanceof Error ? e.message : 'Failed to load exercises';
		} finally {
			isLoadingExercises = false;
		}
	}

	// Load exercises when switching to Exercises tab
	$effect(() => {
		if (currentPage.current === 'Exercises' && !exerciseId && !isNewExercise) {
			loadExercises();
		}
	});

	// --------------------------------------------------------------------------------
	// Exercise Editor State
	// --------------------------------------------------------------------------------
	let currentExercise = $state<ExerciseFormData>(createDefaultExerciseFormData());
	let isLoadingExercise = $state(false);
	let exerciseLoadError = $state<string | null>(null);

	// Load exercise when exerciseId changes
	$effect(() => {
		if (exerciseId) {
			loadExercise(exerciseId);
		} else if (isNewExercise) {
			currentExercise = createDefaultExerciseFormData();
		}
	});

	async function loadExercise(id: string) {
		isLoadingExercise = true;
		exerciseLoadError = null;

		try {
			const data = await getExercise({ id });
			if (data) {
				currentExercise = {
					courseId: data.courseId,
					type: data.type as ExerciseFormData['type'],
					content: data.content as ExerciseContent,
					config: data.config as ExerciseConfig,
					published: data.published,
					order: data.order
				};
			}
		} catch (e) {
			exerciseLoadError = e instanceof Error ? e.message : 'Failed to load exercise';
		} finally {
			isLoadingExercise = false;
		}
	}

	async function handleSaveExercise(data: ExerciseFormData) {
		if (isNewExercise) {
			const result = await createExercise({
				courseId: data.courseId,
				type: data.type,
				content: data.content,
				config: data.config,
				published: data.published,
				order: data.order
			});
			if (result?.id) {
				goto(`?exerciseId=${result.id}`, { replaceState: true });
			}
		} else if (exerciseId) {
			await updateExercise({
				id: exerciseId,
				courseId: data.courseId,
				type: data.type,
				content: data.content,
				config: data.config,
				published: data.published,
				order: data.order
			});
		}
	}

	function handleCancelExercise() {
		goto('?', { replaceState: true });
		currentPage.current = 'Exercises';
	}

	// --------------------------------------------------------------------------------
	// Exercise List Actions
	// --------------------------------------------------------------------------------
	async function handleTogglePublish(id: string, currentlyPublished: boolean) {
		try {
			if (currentlyPublished) {
				await unpublishExercise({ id });
			} else {
				await publishExercise({ id });
			}
			await loadExercises();
		} catch (e) {
			alert('Failed to update publish status');
		}
	}

	async function handleDeleteExercise(id: string) {
		if (!confirm('Are you sure you want to delete this exercise?')) return;

		try {
			await deleteExercise({ id });
			await loadExercises();
		} catch (e) {
			alert('Failed to delete exercise');
		}
	}

	function getTypeIcon(type: string) {
		switch (type) {
			case 'io':
				return '⌨️';
			case 'turtle':
				return '🐢';
			case 'robot':
				return '🤖';
			default:
				return '📝';
		}
	}

	function formatDate(timestamp: number) {
		return new Date(timestamp).toLocaleDateString();
	}
</script>

<!-- Course Detail View -->
{#if courseId}
	<div class="flex gap-2 p-2">
		<div class="">
			<div class="gap-4">
				<button class="btn btn-primary" onclick={() => goto('?')}>Back</button>
			</div>
			<div class="mx-auto flex w-full flex-col justify-center gap-4">
				<h1 class="text-4xl font-bold">Course {courseId}</h1>
				<fieldset class="fieldset w-full">
					<legend class="fieldset-legend">Description</legend>
					<textarea class="textarea h-24 w-full" placeholder="Bio"></textarea>
				</fieldset>
			</div>
		</div>
		<div>
			<TurtleCanvas bind:this={turtleRef} width={500} height={500} />
		</div>
	</div>

<!-- Exercise Editor View -->
{:else if exerciseId || isNewExercise}
	<div class="p-4">
		<div class="mb-4">
			<button class="btn btn-ghost btn-sm" onclick={() => goto('?')}>
				← Back to list
			</button>
		</div>

		{#if isLoadingExercise}
			<div class="flex min-h-96 items-center justify-center">
				<span class="loading loading-lg loading-spinner"></span>
			</div>
		{:else if exerciseLoadError}
			<div class="alert alert-error">
				<span>{exerciseLoadError}</span>
				<button class="btn btn-sm" onclick={() => exerciseId && loadExercise(exerciseId)}>
					Retry
				</button>
			</div>
		{:else}
			<ExerciseEditor
				bind:exercise={currentExercise}
				isNew={isNewExercise}
				onSave={handleSaveExercise}
				onCancel={handleCancelExercise}
			/>
		{/if}
	</div>

<!-- Main CMS View (Tabs) -->
{:else}
	<div class="p-4">
		<!-- Tab Navigation -->
		<div class="tabs-box tabs w-fit">
			{#each possiblePages as item (item)}
				<button
					onclick={() => (currentPage.current = item)}
					class="tab"
					class:tab-active={currentPage.current.startsWith(item)}
					role="tab"
				>
					{item}
				</button>
			{/each}
		</div>

		<!-- Courses Tab -->
		{#if currentPage.current === possiblePages[0]}
		<Courses/>
			<div class="flex gap-2 p-2">
				<button
					class="btn btn-ghost btn-sm"
					class:btn-active={currentView.current === 'Cards'}
					onclick={() => (currentView.current = 'Cards')}
				>
					<Icon icon="ic:round-grid-view" class="text-2xl" />
				</button>
				<button
					class="btn btn-ghost btn-sm"
					class:btn-active={currentView.current === 'List'}
					onclick={() => (currentView.current = 'List')}
				>
					<Icon icon="ic:outline-table-chart" class="text-2xl" />
				</button>
			</div>

			<br />

			<div hidden={currentView.current !== 'Cards'} class="grid grid-cols-3 gap-4">
				{#each tempCourses as course (course.id)}
					<div class="card w-fit bg-base-100 shadow-lg">
						<figure>
							<img src="https://picsum.photos/300/200" alt="Course" />
						</figure>
						<div class="card-body">
							<h2 class="card-title">{course.name}</h2>
							<p class="card-text badge badge-primary">{course.description}</p>
							<p class="card-text badge badge-secondary">Exercises: {course.exercises}</p>
							<div class="card-actions justify-end">
								<button
									title="Edit"
									class="btn btn-primary"
									onclick={() => {
										goto(`?courseId=${course.id}`, {
											replaceState: false,
											keepFocus: true,
											noScroll: true
										});
									}}
								>
									Edit
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>

		<!-- Exercises Tab -->
		{:else if currentPage.current === possiblePages[1]}
			<!-- Header with filters and new button -->
			<div class="mb-4 flex flex-wrap items-end justify-between gap-4 p-2">
				<div class="flex flex-wrap gap-4">
					<!-- Type Filter -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Type</span>
						</label>
						<select
							class="select select-bordered select-sm"
							bind:value={filterType}
							onchange={loadExercises}
						>
							<option value="">All types</option>
							<option value="io">I/O</option>
							<option value="turtle">Turtle</option>
							<option value="robot">Robot</option>
						</select>
					</div>

					<!-- Status Filter -->
					<div class="form-control">
						<label class="label">
							<span class="label-text">Status</span>
						</label>
						<select
							class="select select-bordered select-sm"
							bind:value={filterPublished}
							onchange={loadExercises}
						>
							<option value="">All</option>
							<option value="true">Published</option>
							<option value="false">Draft</option>
						</select>
					</div>
				</div>

				<!-- New Exercise Button -->
				<button class="btn btn-primary" onclick={() => goto('?new=exercise')}>
					<Icon icon="ic:round-add" class="text-xl" />
					New Exercise
				</button>
			</div>

			<!-- Exercise List -->
			{#if isLoadingExercises}
				<div class="flex min-h-96 items-center justify-center">
					<span class="loading loading-lg loading-spinner"></span>
				</div>
			{:else if exercisesError}
				<div class="alert alert-error">
					<span>{exercisesError}</span>
					<button class="btn btn-sm" onclick={loadExercises}>Retry</button>
				</div>
			{:else if exercises.length === 0}
				<div class="rounded-lg border-2 border-dashed border-base-300 p-12 text-center">
					<h3 class="text-lg font-medium">No exercises found</h3>
					<p class="mt-1 text-base-content/60">Get started by creating your first exercise.</p>
					<button class="btn btn-primary mt-4" onclick={() => goto('?new=exercise')}>
						Create Exercise
					</button>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="table">
						<thead>
							<tr>
								<th>Type</th>
								<th>Title</th>
								<th>Status</th>
								<th>Order</th>
								<th>Updated</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each exercises as exercise (exercise.id)}
								<tr class="hover">
									<td>
										<span class="text-2xl" title={exercise.type}>
											{getTypeIcon(exercise.type)}
										</span>
									</td>
									<td>
										<div class="font-medium">
											{exercise.content?.title?.en ||
												exercise.content?.title?.de ||
												'Untitled'}
										</div>
										{#if exercise.content?.title?.de && exercise.content?.title?.en}
											<div class="text-xs text-base-content/60">
												DE: {exercise.content.title.de}
											</div>
										{/if}
									</td>
									<td>
										{#if exercise.published}
											<span class="badge badge-success">Published</span>
										{:else}
											<span class="badge badge-ghost">Draft</span>
										{/if}
									</td>
									<td>
										<span class="text-base-content/60">{exercise.order}</span>
									</td>
									<td>
										<span class="text-sm text-base-content/60">
											{formatDate(exercise.updatedAt)}
										</span>
									</td>
									<td>
										<div class="flex gap-1">
											<button
												class="btn btn-ghost btn-xs"
												title="Edit"
												onclick={() => goto(`?exerciseId=${exercise.id}`)}
											>
												✏️
											</button>
											<button
												type="button"
												class="btn btn-ghost btn-xs"
												title={exercise.published ? 'Unpublish' : 'Publish'}
												onclick={() =>
													handleTogglePublish(exercise.id, exercise.published)}
											>
												{exercise.published ? '📤' : '📥'}
											</button>
											<button
												type="button"
												class="btn btn-ghost btn-xs text-error"
												title="Delete"
												onclick={() => handleDeleteExercise(exercise.id)}
											>
												🗑️
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	</div>
{/if}
