<script lang="ts">
	import { History, RotateCcw } from '@lucide/svelte';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';

	type VersionItem = {
		id: string;
		message: string;
		createdBy: string;
		createdAt: number;
		type: string | null;
		published: boolean | null;
		title: unknown;
	};

	type Props = {
		versions: VersionItem[];
		loading: boolean;
		restoringVersionId: string | null;
		onRestoreVersion: (versionId: string) => void;
	};

	let { versions, loading, restoringVersionId, onRestoreVersion }: Props = $props();

	function getVersionTitle(version: VersionItem): string {
		const value = version.title;
		if (value && typeof value === 'object' && 'title' in value) {
			return getLocalized((value as { title: { de: string; en: string } }).title);
		}
		return '';
	}
</script>

<section class="mt-4 rounded-2xl border border-base-300 bg-base-100 p-4">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h2 class="flex items-center gap-2 text-lg font-semibold">
				<History class="h-5 w-5" />
				{i18n.cms_exercise_versions_title}
			</h2>
			<p class="text-sm text-base-content/65">{i18n.cms_exercise_versions_hint}</p>
		</div>
		<span class="badge badge-outline">{versions.length}</span>
	</div>

	{#if loading}
		<div class="mt-3 text-sm text-base-content/60">{i18n.cms_loading}</div>
	{:else if versions.length === 0}
		<div
			class="mt-3 rounded-xl border border-dashed border-base-300 p-4 text-sm text-base-content/65"
		>
			{i18n.cms_exercise_versions_empty}
		</div>
	{:else}
		<div class="mt-4 space-y-3">
			{#each versions as version (version.id)}
				<div
					class="flex flex-col gap-3 rounded-xl border border-base-300 p-3 lg:flex-row lg:items-center lg:justify-between"
				>
					<div class="space-y-1">
						<div class="flex flex-wrap items-center gap-2">
							<span class="font-medium">{version.message}</span>
							{#if version.published === true}
								<span class="badge badge-sm badge-success">{i18n.published}</span>
							{:else if version.published === false}
								<span class="badge badge-sm badge-warning">{i18n.draft}</span>
							{/if}
						</div>
						<div class="text-sm text-base-content/65">
							{new Date(version.createdAt).toLocaleString()}
							·
							{version.createdBy}
						</div>
						{#if getVersionTitle(version)}
							<div class="text-sm text-base-content/80">{getVersionTitle(version)}</div>
						{/if}
					</div>

					<button
						type="button"
						class="btn btn-outline btn-sm"
						onclick={() => onRestoreVersion(version.id)}
						disabled={restoringVersionId === version.id}
					>
						<RotateCcw class="h-4 w-4" />
						{restoringVersionId === version.id ? i18n.cms_restoring : i18n.cms_restore}
					</button>
				</div>
			{/each}
		</div>
	{/if}
</section>
