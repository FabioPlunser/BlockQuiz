<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ExerciseEditor from '$lib/components/ExerciseEditor.svelte';
	import { getExercise, updateExercise, deleteExercise } from '$lib/remote/exercises.remote';
	import type { ExerciseFormData, ExerciseContent, ExerciseConfig } from '$lib/types/exercise';
	import { createDefaultExerciseFormData } from '$lib/types/exercise';
	import { onMount } from 'svelte';

	let exerciseId = $derived(page.params.id);

	let exercise = $state<ExerciseFormData>(createDefaultExerciseFormData());
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let isDeleting = $state(false);

	onMount(async () => {
		await loadExercise();
	});

	async function loadExercise() {
		isLoading = true;
		loadError = null;

		try {
			const data = await getExercise({ id: exerciseId });

			if (data) {
				exercise = {
					courseId: data.courseId,
					type: data.type as ExerciseFormData['type'],
					content: data.content as ExerciseContent,
					config: data.config as ExerciseConfig,
					published: data.published,
					order: data.order
				};
			}
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load exercise';
		} finally {
			isLoading = false;
		}
	}

	async function handleSave(data: ExerciseFormData) {
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

	function handleCancel() {
		goto('/cms/exercises');
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this exercise? This action cannot be undone.')) {
			return;
		}

		isDeleting = true;

		try {
			await deleteExercise({ id: exerciseId });
			goto('/cms/exercises');
		} catch (e) {
			alert('Failed to delete exercise');
		} finally {
			isDeleting = false;
		}
	}
</script>

<svelte:head>
	<title>Edit Exercise | CMS</title>
</svelte:head>

<div class="container mx-auto p-4">
	{#if isLoading}
		<div class="flex min-h-96 items-center justify-center">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if loadError}
		<div class="alert alert-error">
			<span>{loadError}</span>
			<button class="btn btn-sm" onclick={loadExercise}>Retry</button>
		</div>
	{:else}
		<ExerciseEditor
			bind:exercise
			isNew={false}
			onSave={handleSave}
			onCancel={handleCancel}
		/>

		<!-- Delete Section -->
		<div class="mt-8 rounded-lg border border-error/30 bg-error/5 p-4">
			<h3 class="text-lg font-bold text-error">Danger Zone</h3>
			<p class="mt-1 text-sm text-base-content/70">
				Deleting this exercise is permanent and cannot be undone.
			</p>
			<button
				type="button"
				class="btn btn-error btn-sm mt-3"
				onclick={handleDelete}
				disabled={isDeleting}
			>
				{#if isDeleting}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				Delete Exercise
			</button>
		</div>
	{/if}
</div>
