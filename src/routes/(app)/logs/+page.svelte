<script lang="ts">
	import {
		getAuditLogs,
		getAuditUsers,
		exportAuditLogsCsv,
		type LogEntry,
		type LogLevelFilter,
		type LogCategoryFilter
	} from '$remote/logs.remote';
	import { PersistedState } from 'runed';
	import DataTable, { type Column } from '$lib/components/DataTable.svelte';
	import { Debounced } from 'runed';
	import ColumnPicker from '$lib/components/ColumnPicker.svelte';
	import SearchableDropdown from '$lib/components/SearchableDropdown.svelte';
	import ExportLogsModal from '$lib/components/ExportLogsModal.svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import { Search, RefreshCw, Download } from '@lucide/svelte';
	import Boundary from '$cp/Boundary.svelte';

	const pageSize = 25;

	let searchQuery = $state('');
	let selectedLevel = $state<LogLevelFilter>('all');
	let selectedCategory = $state<LogCategoryFilter>('all');
	let selectedUserId = $state<string>('');
	let currentPage = $state(1);
	let exporting = $state(false);
	let exportModalOpen = $state(false);
	const debouncedQuery = new Debounced(() => searchQuery.trim(), 200);

	let logs = $derived(
		getAuditLogs({
			page: currentPage,
			pageSize,
			level: selectedLevel,
			category: selectedCategory,
			actorUserId: selectedUserId || undefined,
			search: debouncedQuery.current
		})
	);

	let users = $derived(getAuditUsers());

	$effect(() => {
		if (selectedCategory === 'system' && selectedUserId) {
			selectedUserId = '';
		}
	});

	let visibleColumns = new PersistedState<string[]>('logsVisibleColumns', [
		'timestamp',
		'category',
		'level',
		'message',
		'actorUserId',
		'details'
	]);

	function getLevelBadgeClass(level: string) {
		switch (level) {
			case 'info':
				return 'badge-info';
			case 'warn':
				return 'badge-warning';
			case 'error':
				return 'badge-error';
			default:
				return 'badge-ghost';
		}
	}

	function getCategoryBadgeClass(category: string) {
		switch (category) {
			case 'admin':
				return 'badge-warning';
			case 'user':
				return 'badge-success';
			case 'system':
				return 'badge-neutral';
			default:
				return 'badge-ghost';
		}
	}

	function handlePageChange(page: number) {
		currentPage = page;
	}

	async function runExport(input: {
		fromTs: number;
		toTs: number;
		categories: ('system' | 'admin' | 'user')[];
		columns: (
			| 'timestamp'
			| 'category'
			| 'level'
			| 'action'
			| 'actorEmail'
			| 'actorUserId'
			| 'message'
			| 'details'
			| 'source'
		)[];
	}) {
		exporting = true;
		try {
			const result = await exportAuditLogsCsv({
				level: selectedLevel,
				categories: input.categories,
				columns: input.columns,
				fromTs: input.fromTs,
				toTs: input.toTs,
				actorUserId: selectedUserId || undefined,
				search: debouncedQuery.current,
				limit: 50000
			});
			const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = result.filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
			exportModalOpen = false;
		} finally {
			exporting = false;
		}
	}

	type LogWithId = LogEntry & { id: string };

	let tableColumns = $derived<Column<LogWithId>[]>([
		{
			key: 'timestamp',
			label: i18n.logs_timestamp,
			sortable: true,
			class: 'whitespace-nowrap',
			cellSnippet: 'timestamp'
		},
		{
			key: 'category',
			label: i18n.logs_category,
			sortable: true,
			cellSnippet: 'category'
		},
		{
			key: 'level',
			label: i18n.logs_level,
			sortable: true,
			cellSnippet: 'level'
		},
		{
			key: 'message',
			label: i18n.logs_message,
			sortable: true,
			class: 'font-medium'
		},
		{
			key: 'actorUserId',
			label: i18n.logs_actor,
			cellSnippet: 'actor'
		},
		{
			key: 'details',
			label: i18n.logs_details,
			cellSnippet: 'details'
		}
	]);
</script>

<svelte:head>
	<title>{i18n.logs_title} | BlockQuiz</title>
</svelte:head>

{#snippet levelCell(log: LogWithId)}
	<div class="badge {getLevelBadgeClass(log.level)} gap-2 text-xs font-bold uppercase">
		{log.level}
	</div>
{/snippet}

{#snippet categoryCell(log: LogWithId)}
	<div class="badge {getCategoryBadgeClass(log.category ?? '')} gap-2 text-xs uppercase">
		{log.category ?? '—'}
	</div>
{/snippet}

{#snippet actorCell(log: LogWithId)}
	<span class="text-xs opacity-70">{log.actorEmail ?? '—'}</span>
{/snippet}

{#snippet detailsCell(log: LogWithId)}
	<div class="collapse-arrow collapse rounded-box bg-base-300">
		<input type="checkbox" />
		<div class="collapse-title min-h-0 py-2 font-mono text-xs">{i18n.logs_view_json}</div>
		<div class="collapse-content">
			<pre class="overflow-x-auto p-2 text-xs"><code>{JSON.stringify(log, null, 2)}</code></pre>
		</div>
	</div>
{/snippet}

{#snippet timestampCell(log: LogWithId)}
	<span class="font-mono text-xs whitespace-nowrap opacity-70">
		{new Date(log.timestamp).toLocaleString()}
	</span>
{/snippet}

<div class="mx-auto w-full space-y-6 p-6">
	<h1 class="text-2xl font-bold">{i18n.logs_title}</h1>

	<section
		class="card gap-4 border border-base-300 bg-base-100 p-4 text-sm shadow-sm w-full"
	>
		<div class="flex flex-wrap items-end gap-4">
			<label class="input-bordered input flex w-full max-w-md items-center gap-2">
				<input
					type="text"
					class="grow"
					placeholder={i18n.logs_search_placeholder}
					bind:value={searchQuery}
				/>
				<Search class="h-4 w-4 opacity-60" />
			</label>

			<select class="select-bordered select w-40" bind:value={selectedCategory}>
				<option value="all">{i18n.logs_all_categories}</option>
				<option value="system">{i18n.logs_category_system}</option>
				<option value="admin">{i18n.logs_category_admin}</option>
				<option value="user">{i18n.logs_category_user}</option>
			</select>

			<select class="select-bordered select w-40" bind:value={selectedLevel}>
				<option value="all">{i18n.logs_all_levels}</option>
				<option value="info">{i18n.logs_level_info}</option>
				<option value="warn">{i18n.logs_level_warning}</option>
				<option value="error">{i18n.logs_level_error}</option>
			</select>

			{#if selectedCategory !== 'system'}
				{#await users then userList}
					<SearchableDropdown
						bind:value={selectedUserId}
						options={userList.map((u) => ({ value: u.id, label: u.label }))}
						placeholder={i18n.logs_all_users}
						searchPlaceholder={i18n.logs_user_filter}
						emptyOptionLabel={i18n.logs_all_users}
					/>
				{/await}
			{/if}

			<ColumnPicker columns={tableColumns} bind:visibleColumns={visibleColumns.current} />

			<div class="ml-auto flex gap-2">
				<button class="btn btn-sm" onclick={() => (exportModalOpen = true)} disabled={exporting}>
					<Download class="h-4 w-4" />
					{exporting ? i18n.logs_exporting : i18n.logs_export_csv}
				</button>
				<button
					class="btn btn-sm btn-primary"
					onclick={() => logs.refresh()}
					disabled={logs.loading}
				>
					<RefreshCw class="h-4 w-4 {logs.loading ? 'animate-spin' : ''}" />
					{logs.loading ? i18n.logs_refreshing : i18n.logs_refresh}
				</button>
			</div>
		</div>

		<Boundary>
			{#await logs then data}
				<div class="max-h-[60vh] overflow-auto">
					<DataTable
						items={data.logs.map((log) => ({ ...log, id: log.__key ?? String(log.timestamp) }))}
						columns={tableColumns}
						bind:visibleColumns={visibleColumns.current}
						showSearch={false}
						showPagination={true}
						{pageSize}
						bind:currentPage
						totalItems={data.totalFiltered}
						serverSidePagination={true}
						onPageChange={handlePageChange}
						emptyMessage={i18n.logs_empty}
						tableClass="[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10"
						cellSnippets={{
							timestamp: timestampCell,
							category: categoryCell,
							level: levelCell,
							actor: actorCell,
							details: detailsCell
						}}
					/>
				</div>
			{/await}
		</Boundary>
	</section>
</div>

<ExportLogsModal
	open={exportModalOpen}
	{exporting}
	onClose={() => (exportModalOpen = false)}
	onExport={runExport}
/>
