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
		changes?: string[];
	};

	type Props = {
		versions: VersionItem[];
		loading: boolean;
		restoringVersionId: string | null;
		onRestoreVersion: (versionId: string) => void;
	};

	let { versions, loading, restoringVersionId, onRestoreVersion }: Props = $props();

	const MAX_CHANGES_VISIBLE = 6;

	function getVersionTitle(version: VersionItem): string {
		const value = version.title;
		if (value && typeof value === 'object' && 'title' in value) {
			return getLocalized((value as { title: { de: string; en: string } }).title);
		}
		return '';
	}

	// Pretty-print a dot-path like `content.title.en` → `content › title › en`.
	function prettyPath(path: string): string {
		return path.replace(/\./g, ' › ');
	}
</script>

<section class="rounded-2xl border border-base-300 bg-base-100 p-4">
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
		<!-- Scrollable list: caps to ~70vh so the diff content doesn't push the
		     editor's section nav off-screen on small windows. -->
		<div class="mt-4 max-h-[70vh] space-y-3 overflow-y-auto pr-2">
			{#each versions as version (version.id)}
				{@const changes = version.changes ?? []}
				{@const visibleChanges = changes.slice(0, MAX_CHANGES_VISIBLE)}
				{@const hiddenChangesCount = Math.max(0, changes.length - MAX_CHANGES_VISIBLE)}
				<div class="rounded-xl border border-base-300 p-3">
					<div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
							class="btn btn-outline btn-sm self-start"
							onclick={() => onRestoreVersion(version.id)}
							disabled={restoringVersionId === version.id}
						>
							<RotateCcw class="h-4 w-4" />
							{restoringVersionId === version.id ? i18n.cms_restoring : i18n.cms_restore}
						</button>
					</div>

					<div class="mt-3 border-t border-base-200 pt-3">
						{#if changes.length === 0}
							<p class="text-xs text-base-content/60">
								{i18n.cms_exercise_versions_no_changes}
							</p>
						{:else}
							<p class="mb-1 text-xs font-semibold text-base-content/70">
								{i18n.cms_exercise_versions_changes_label}
							</p>
							<ul class="flex flex-wrap gap-1.5">
								{#each visibleChanges as path (path)}
									<li
										class="rounded-full bg-base-200 px-2 py-0.5 font-mono text-xs text-base-content/80"
									>
										{prettyPath(path)}
									</li>
								{/each}
								{#if hiddenChangesCount > 0}
									<li class="text-xs text-base-content/60">
										{i18n.cms_exercise_versions_changes_more.replace(
											'{n}',
											String(hiddenChangesCount)
										)}
									</li>
								{/if}
							</ul>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</section>
