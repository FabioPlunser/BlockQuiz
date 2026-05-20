<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
	import { Debounced } from 'runed';
	import Boundary from '$cp/Boundary.svelte';
	import DataTable, { type Column } from '$cp/DataTable.svelte';
	import SearchableDropdown from '$cp/SearchableDropdown.svelte';
	import ClassEditor from '$cp/cms/ClassEditor.svelte';
	import ClassDetailModal from '$cp/cms/ClassDetailModal.svelte';
	import IdpGroupDiscovery from '$cp/cms/IdpGroupDiscovery.svelte';
	import {
		getClasses,
		deleteClass,
		archiveClass,
		restoreClass,
		setClassMembers
	} from '$remote/classes.remote';
	import { getSsoProviders } from '$remote/settings.remote';
	import { getAssignableStudents } from '$remote/users.remote';
	import { showError, showSuccess } from '$lib/utils/toast';
	import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Lock } from '@lucide/svelte';

	type Source = 'all' | 'sso' | 'manual';
	type ClassRow = {
		id: string;
		name: string;
		description: string | null;
		ssoProviderId: string | null;
		providerDomain: string | null;
		externalKey: string | null;
		archivedAt: number | null;
		memberCount: number;
		courseCount: number;
		memberIds: string[];
		ssoMemberIds: string[];
	};
	type EditingClass = {
		id: string;
		name: string;
		description: string | null;
		ssoProviderId: string | null;
		externalKey: string | null;
	};

	let search = $state('');
	let sourceFilter = $state<Source>('all');
	let includeArchived = $state(false);
	let providerFilter = $state<string>('');

	const debouncedSearch = new Debounced(() => search, 200);
	// Server filter only honours kind/provider/archived; free-text search is
	// delegated to DataTable's client-side filter.
	const filters = $derived({
		source: sourceFilter,
		includeArchived,
		ssoProviderId: providerFilter || undefined
	});

	// Stable query handles — read via .current so the Boundary's $effect.pending()
	// re-triggers on refresh() and the panel doesn't black out.
	const classesHandle = $derived(getClasses(filters));
	const providersHandle = getSsoProviders();
	const studentsHandle = getAssignableStudents();

	const classRows = $derived((classesHandle.current ?? []) as ClassRow[]);
	const providers = $derived(providersHandle.current ?? []);
	const studentOptions = $derived(
		(studentsHandle.current ?? []).map((s) => ({
			value: s.id,
			label: s.email ?? s.id
		}))
	);

	let editorOpen = $state(false);
	let editing = $state<EditingClass | null>(null);
	let detailOpen = $state(false);
	let detailClassId = $state<string | null>(null);

	function openCreate() {
		editing = null;
		editorOpen = true;
	}

	function openEdit(row: ClassRow) {
		editing = {
			id: row.id,
			name: row.name,
			description: row.description,
			ssoProviderId: row.ssoProviderId,
			externalKey: row.externalKey
		};
		editorOpen = true;
	}

	function openDetail(id: string) {
		detailClassId = id;
		detailOpen = true;
	}

	async function handleDelete(row: ClassRow) {
		const message = i18n.class_delete_confirm.replace('{name}', row.name);
		if (!confirm(message)) return;
		const result = await deleteClass({ id: row.id }).updates(getClasses);
		if (result.success) {
			showSuccess(i18n.class_deleted);
		} else {
			showError(result.error ?? i18n.toast_generic_error);
		}
	}

	async function handleArchive(row: ClassRow) {
		const action = row.archivedAt ? restoreClass : archiveClass;
		const result = await action({ id: row.id }).updates(getClasses);
		if (result.success) {
			showSuccess(row.archivedAt ? i18n.class_restored : i18n.class_archived);
		}
	}

	async function handleSetMembers(row: ClassRow, nextUserIds: string[]) {
		const result = await setClassMembers({ classId: row.id, userIds: nextUserIds }).updates(
			getClasses
		);
		if (!result.success) {
			showError(result.error ?? i18n.toast_generic_error);
			return;
		}
		if (result.added > 0 || result.removed > 0) {
			showSuccess(
				result.added > 0 ? i18n.class_member_added : i18n.class_member_removed
			);
		}
	}

	const columns: Column<ClassRow>[] = $derived([
		{
			key: 'name',
			label: i18n.classes_table_name,
			sortable: true,
			searchable: true,
			render: (r) => r.name,
			cellSnippet: 'name'
		},
		{
			key: 'source',
			label: i18n.classes_table_source,
			sortable: true,
			searchable: true,
			render: (r) =>
				r.ssoProviderId
					? `${i18n.classes_source_sso_badge} · ${r.providerDomain ?? ''}`
					: i18n.classes_source_manual_badge,
			cellSnippet: 'source'
		},
		{
			key: 'externalKey',
			label: i18n.classes_table_external_key,
			searchable: true,
			render: (r) => r.externalKey ?? '—',
			cellSnippet: 'externalKey'
		},
		{
			key: 'members',
			label: i18n.classes_table_members,
			class: 'w-72',
			cellSnippet: 'members'
		},
		{
			key: 'courseCount',
			label: i18n.classes_table_courses,
			sortable: true,
			render: (r) => String(r.courseCount)
		}
	]);
</script>

<Boundary>
	<div class="flex flex-col gap-4">
		{#if providers.length > 0}
			<IdpGroupDiscovery onPromoted={() => getClasses(filters).refresh()} />
		{/if}

		<section class="card border border-base-300 bg-base-100 shadow-sm">
			<div class="card-body gap-4">
				<div class="flex items-start justify-between gap-4">
					<button class="btn btn-sm btn-primary" onclick={openCreate}>
						<Plus class="h-4 w-4" />
						{i18n.classes_add}
					</button>
				</div>

				<div class="flex flex-wrap items-end gap-3">
					<label class="form-control">
						<span class="label-text text-xs">{i18n.classes_filter_source}</span>
						<select class="select-bordered select select-sm" bind:value={sourceFilter}>
							<option value="all">{i18n.classes_filter_source_all}</option>
							<option value="sso">{i18n.classes_filter_source_sso}</option>
							<option value="manual">{i18n.classes_filter_source_manual}</option>
						</select>
					</label>

					{#if providers.length > 0}
						<label class="form-control">
							<span class="label-text text-xs">IdP</span>
							<select class="select-bordered select select-sm" bind:value={providerFilter}>
								<option value="">{i18n.classes_filter_source_all}</option>
								{#each providers as p (p.id)}
									<option value={p.id}>{p.domain}</option>
								{/each}
							</select>
						</label>
					{/if}

					<label class="flex cursor-pointer items-center gap-2 text-sm">
						<input
							type="checkbox"
							class="checkbox checkbox-sm"
							bind:checked={includeArchived}
						/>
						{i18n.classes_filter_include_archived}
					</label>

					<input
						type="text"
						class="input-bordered input input-sm ml-auto max-w-xs"
						placeholder={i18n.classes_search_placeholder}
						bind:value={search}
					/>
				</div>

				<DataTable
					items={classRows}
					{columns}
					searchQuery={debouncedSearch.current}
					searchPlaceholder={i18n.classes_search_placeholder}
					showSearch={false}
					emptyMessage={i18n.classes_empty}
					rowActions={rowActions as never}
					cellSnippets={{
						name: nameCell as never,
						source: sourceCell as never,
						externalKey: externalKeyCell as never,
						members: membersCell as never
					}}
				/>
			</div>
		</section>
	</div>
</Boundary>

{#snippet nameCell(row: ClassRow)}
	<button class="link font-medium link-hover" onclick={() => openDetail(row.id)}>
		{row.name}
	</button>
	{#if row.archivedAt}
		<span class="ml-2 badge badge-xs badge-warning">{i18n.classes_archived_badge}</span>
	{/if}
{/snippet}

{#snippet sourceCell(row: ClassRow)}
	{#if row.ssoProviderId}
		<span class="badge badge-sm badge-info">{i18n.classes_source_sso_badge}</span>
		<span class="ml-1 text-xs text-base-content/60">{row.providerDomain ?? ''}</span>
	{:else}
		<span class="badge badge-ghost badge-sm">{i18n.classes_source_manual_badge}</span>
	{/if}
{/snippet}

{#snippet externalKeyCell(row: ClassRow)}
	<span class="font-mono text-xs text-base-content/70">{row.externalKey ?? '—'}</span>
{/snippet}

{#snippet membersCell(row: ClassRow)}
	{#if row.ssoProviderId}
		<span
			class="inline-flex items-center gap-1 text-xs text-base-content/60"
			title={i18n.class_member_sso_locked}
		>
			<Lock class="h-3 w-3" />
			{row.memberCount}
			<span class="ml-1">{i18n.class_idp_locked_short}</span>
		</span>
	{:else}
		{@const ssoBadges = Object.fromEntries(
			row.ssoMemberIds.map((id) => [id, i18n.class_dropdown_idp_suffix])
		)}
		<SearchableDropdown
			options={studentOptions}
			multiSelect
			values={row.memberIds}
			disabledValues={row.ssoMemberIds}
			optionBadges={ssoBadges}
			placeholder={i18n.class_dropdown_member_placeholder}
			searchPlaceholder={i18n.class_member_search_placeholder}
			emptyLabel={i18n.class_dropdown_empty}
			doneLabel={i18n.class_dropdown_done}
			multiSelectedTemplate={i18n.class_dropdown_n_selected}
			buttonClass="select-bordered select select-sm w-full text-left"
			onChangeMulti={(next) => handleSetMembers(row, next)}
		/>
	{/if}
{/snippet}

{#snippet rowActions(row: ClassRow)}
	<button
		class="btn btn-ghost btn-xs"
		aria-label={i18n.class_edit_title}
		onclick={() => openEdit(row)}
	>
		<Pencil class="h-3 w-3" />
	</button>
	<button
		class="btn btn-ghost btn-xs"
		aria-label={row.archivedAt ? i18n.class_restore : i18n.class_archive}
		onclick={() => handleArchive(row)}
	>
		{#if row.archivedAt}
			<ArchiveRestore class="h-3 w-3" />
		{:else}
			<Archive class="h-3 w-3" />
		{/if}
	</button>
	<button
		class="btn text-error btn-ghost btn-xs"
		aria-label={i18n.class_delete}
		onclick={() => handleDelete(row)}
	>
		<Trash2 class="h-3 w-3" />
	</button>
{/snippet}

<ClassEditor
	bind:open={editorOpen}
	{editing}
	providers={providers.map((p) => ({ id: p.id, domain: p.domain }))}
	onClose={() => {
		editing = null;
		getClasses(filters).refresh();
	}}
/>

<ClassDetailModal
	bind:open={detailOpen}
	classId={detailClassId}
	onClose={() => {
		detailClassId = null;
		getClasses(filters).refresh();
	}}
/>
