<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ExerciseEditor from '$lib/components/ExerciseEditor.svelte';
	import { createExercise } from '$lib/remote/exercises.remote';
	import type { ExerciseFormData } from '$lib/types/exercise';
	import { createDefaultExerciseFormData } from '$lib/types/exercise';

	// Get courseId from query params if provided
	let courseId = $derived(page.url.searchParams.get('courseId') ?? '');

	let exercise = $state(createDefaultExerciseFormData(courseId));

	async function handleSave(data: ExerciseFormData) {
		const result = await createExercise({
			courseId: data.courseId,
			type: data.type,
			content: data.content,
			config: data.config,
			published: data.published,
			order: data.order
		});

		if (result?.id) {
			// Navigate to the edit page for the new exercise
			goto(`/cms/exercises/${result.id}`);
		}
	}

	function handleCancel() {
		// Go back to exercises list or course page
		if (courseId) {
			goto(`/cms/courses/${courseId}`);
		} else {
			goto('/cms/exercises');
		}
	}
</script>

<svelte:head>
	<title>Create Exercise | CMS</title>
</svelte:head>

<div class="container mx-auto p-4">
	<ExerciseEditor
		bind:exercise
		{courseId}
		isNew={true}
		onSave={handleSave}
		onCancel={handleCancel}
	/>
</div>

