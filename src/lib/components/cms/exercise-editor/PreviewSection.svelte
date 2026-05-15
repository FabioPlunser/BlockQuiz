<script lang="ts">
	import type { Exercise, PublishValidationResult } from '$lib/types/exercise';
	import ExercisePlayer from '$cp/player/ExercisePlayer.svelte';
	import { i18n } from '$lib/i18n/index.svelte';

	type Props = {
		previewExercise: Exercise;
		previewVersion: number;
		validationResult: PublishValidationResult | null;
		onRefresh: () => void;
		onEdit: () => void;
	};

	let { previewExercise, previewVersion, validationResult, onRefresh, onEdit }: Props = $props();

	function noop() {}
	function handleSubmit() {
		// Preview uses the learner runtime locally and does not persist attempts.
	}
</script>

<div class="space-y-4">
	<div
		class="flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 lg:flex-row lg:items-center lg:justify-between"
	>
		<div>
			<h2 class="text-lg font-semibold">{i18n.cms_preview_title}</h2>
			<p class="mt-1 text-sm text-base-content/65">{i18n.cms_preview_hint}</p>
		</div>

		<div class="flex flex-wrap gap-2">
			<button type="button" class="btn btn-outline btn-sm" onclick={onRefresh}>
				{i18n.cms_preview_refresh}
			</button>
			<button type="button" class="btn btn-sm btn-primary" onclick={onEdit}>
				{i18n.cms_preview_edit}
			</button>
		</div>
	</div>

	{#if validationResult && !validationResult.valid}
		<div class="rounded-xl border border-warning bg-warning/10 p-4 text-sm text-warning-content">
			{i18n.cms_preview_publish_note}
		</div>
	{/if}

	<div class="min-h-[80vh] rounded-2xl border border-base-300 bg-base-100 p-3">
		{#key previewVersion}
			<ExercisePlayer
				exercise={previewExercise}
				currentIndex={0}
				totalExercises={1}
				onSubmit={handleSubmit}
				onNext={noop}
				hasNextExercise={false}
				initialWorkspaceXml={previewExercise.hasStarterBlocks ? previewExercise.starterXml : ''}
			/>
		{/key}
	</div>
</div>
