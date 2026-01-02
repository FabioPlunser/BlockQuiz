<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		getExercises,
		deleteExercise,
		publishExercise,
		unpublishExercise
	} from '$lib/remote/exercises.remote';
	import type { ExerciseContent } from '$lib/types/exercise';
	import { onMount } from 'svelte';

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
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);

	// Filters
	let filterType = $state<string>('');
	let filterPublished = $state<string>('');

	onMount(async () => {
		await loadExercises();
	});

	async function loadExercises() {
		isLoading = true;
		loadError = null;

		try {
			const filters: { type?: 'io' | 'turtle' | 'robot'; published?: boolean } = {};
			if (filterType) filters.type = filterType as 'io' | 'turtle' | 'robot';
			if (filterPublished === 'true') filters.published = true;
			if (filterPublished === 'false') filters.published = false;

			const data = await getExercises(filters);
			exercises = (data ?? []) as ExerciseListItem[];
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load exercises';
		} finally {
			isLoading = false;
		}
	}

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

	async function handleDelete(id: string) {
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

<svelte:head>
	<title>Exercises | CMS</title>
</svelte:head>

<div class="container mx-auto p-4">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Exercises</h1>
			<p class="text-base-content/60">Manage all exercises in the system</p>
		</div>
		<a href="/cms/exercises/new" class="btn btn-primary">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			New Exercise
		</a>
	</div>

	<!-- Filters -->
	<div class="mb-4 flex flex-wrap gap-4">
		<div class="form-control">
			<label class="label">
				<span class="label-text">Type</span>
			</label>
			<select
				class="select-bordered select select-sm"
				bind:value={filterType}
				onchange={loadExercises}
			>
				<option value="">All types</option>
				<option value="io">I/O</option>
				<option value="turtle">Turtle</option>
				<option value="robot">Robot</option>
			</select>
		</div>
		<div class="form-control">
			<label class="label">
				<span class="label-text">Status</span>
			</label>
			<select
				class="select-bordered select select-sm"
				bind:value={filterPublished}
				onchange={loadExercises}
			>
				<option value="">All</option>
				<option value="true">Published</option>
				<option value="false">Draft</option>
			</select>
		</div>
	</div>

	<!-- Content -->
	{#if isLoading}
		<div class="flex min-h-96 items-center justify-center">
			<span class="loading loading-lg loading-spinner"></span>
		</div>
	{:else if loadError}
		<div class="alert alert-error">
			<span>{loadError}</span>
			<button class="btn btn-sm" onclick={loadExercises}>Retry</button>
		</div>
	{:else if exercises.length === 0}
		<div class="rounded-lg border-2 border-dashed border-base-300 p-12 text-center">
			<h3 class="text-lg font-medium">No exercises found</h3>
			<p class="mt-1 text-base-content/60">Get started by creating your first exercise.</p>
			<a href="/cms/exercises/new" class="btn mt-4 btn-primary">Create Exercise</a>
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
									{exercise.content?.title?.en || exercise.content?.title?.de || 'Untitled'}
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
									<a
										href={`/cms/exercises/${exercise.id}`}
										class="btn btn-ghost btn-xs"
										title="Edit"
									>
										✏️
									</a>
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										title={exercise.published ? 'Unpublish' : 'Publish'}
										onclick={() => handleTogglePublish(exercise.id, exercise.published)}
									>
										{exercise.published ? '📤' : '📥'}
									</button>
									<button
										type="button"
										class="btn text-error btn-ghost btn-xs"
										title="Delete"
										onclick={() => handleDelete(exercise.id)}
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
</div>
