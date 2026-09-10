<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { Exercise, PublishValidationResult } from '$lib/types/exercise';
	import ExercisePlayer from '$cp/player/ExercisePlayer.svelte';
	import Loading from '$cp/Loading.svelte';
	import { i18n } from '$lib/i18n/index.svelte';

	type Props = {
		previewExercise: Exercise;
		previewVersion: number;
		validationResult: PublishValidationResult | null;
		onRefresh: () => void;
		onEdit: () => void;
	};

	let { previewExercise, previewVersion, validationResult, onRefresh, onEdit }: Props = $props();

	// Defer the heavy ExercisePlayer mount by one tick so the loading skeleton
	// gets a chance to paint before Blockly's expensive workspace injection runs.
	let ready = $state(false);
	let bootKey = $derived(previewVersion);

	$effect(() => {
		// Re-run when previewVersion changes (Refresh button or applyExercise).
		bootKey;
		ready = false;
		tick().then(() => {
			ready = true;
		});
	});

	onMount(() => {
		tick().then(() => {
			ready = true;
		});
	});

	function noop() {}
	function handleSubmit() {
		// Preview uses the learner runtime locally and does not persist attempts.
	}
</script>

<div class="@container/preview space-y-4">
	<div
		class="flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-4 md:flex-row md:items-center md:justify-between"
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

	<div class="rounded-2xl border border-base-300 bg-base-100 p-3">
		{#key previewVersion}
			{#if ready}
				<ExercisePlayer
					exercise={previewExercise}
					currentIndex={0}
					totalExercises={1}
					onSubmit={handleSubmit}
					onNext={noop}
					hasNextExercise={false}
					initialWorkspaceXml={previewExercise.hasStarterBlocks
						? previewExercise.starterXml
						: ''}
				/>
			{:else}
				<Loading />
			{/if}
		{/key}
	</div>
</div>
