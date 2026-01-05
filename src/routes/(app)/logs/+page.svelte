<script lang="ts">
	import { getAuditLogs, type LogEntry, type LogLevelFilter } from '$remote/logs.remote';
	import { PersistedState } from 'runed';
	import DataTable, { type Column } from '$lib/components/DataTable.svelte';
	import { Debounced } from 'runed';
	import ColumnPicker from '$lib/components/ColumnPicker.svelte';
	import { Search, RefreshCw } from '@lucide/svelte';
	import Boundary from '$cp/Boundary.svelte';

	//-----------------------------------------------------------------------------
	// State
	//-----------------------------------------------------------------------------
	const pageSize = 25;

	let searchQuery = $state('');
	let selectedLevel = $state<LogLevelFilter>('all');
	let currentPage = $state(1);
	const debouncedQuery = new Debounced(() => searchQuery.trim(), 200);

	let logs = $derived(
		getAuditLogs({
			page: currentPage,
			pageSize,
			level: selectedLevel,
			search: debouncedQuery.current
		})
	);

	// Column visibility
	let visibleColumns = new PersistedState<string[]>('logsVisibleColumns', [
		'timestamp',
		'level',
		'message',
		'details'
	]);

	//-----------------------------------------------------------------------------
	// Helpers
	//-----------------------------------------------------------------------------
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

	function handlePageChange(page: number) {
		currentPage = page;
	}

	//-----------------------------------------------------------------------------
	// Table columns definition
	//-----------------------------------------------------------------------------
	type LogWithId = LogEntry & { id: string };

	const tableColumns: Column<LogWithId>[] = [
		{
			key: 'timestamp',
			label: 'Timestamp',
			sortable: true,
			class: 'whitespace-nowrap',
			cellSnippet: 'timestamp' // Reference by key
		},
		{
			key: 'level',
			label: 'Level',
			sortable: true,
			cellSnippet: 'level' // Reference by key
		},
		{
			key: 'message',
			label: 'Message',
			sortable: true,
			class: 'font-medium'
			// No cellSnippet - will use defaultCell
		},
		{
			key: 'details',
			label: 'Details',
			cellSnippet: 'details' // Reference by key
		}
	];
</script>

<!-- Define snippets in template - these will be passed as props -->
{#snippet levelCell(log: LogWithId)}
	<div class="badge {getLevelBadgeClass(log.level)} gap-2 text-xs font-bold uppercase">
		{log.level}
	</div>
{/snippet}

{#snippet detailsCell(log: LogWithId)}
	<div class="collapse-arrow collapse rounded-box bg-base-300">
		<input type="checkbox" />
		<div class="collapse-title min-h-0 py-2 font-mono text-xs">View JSON</div>
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
	<!-- Toolbar -->
	<div
		class="flex flex-row items-center gap-6 rounded-box bg-base-200/50 p-4 text-sm text-base-content/80 shadow-sm"
	>
		<!-- Search + Filter (Left) -->
		<div class="flex w-full flex-col gap-2 md:max-w-md">
			<div class="flex flex-col gap-2 sm:flex-row">
				<label class="input-bordered input flex w-full items-center gap-2">
					<input type="text" class="grow" placeholder="Search logs..." bind:value={searchQuery} />
					<Search class="h-4 w-4 opacity-60" />
				</label>
				<select class="select-bordered select w-full sm:w-40" bind:value={selectedLevel}>
					<option value="all">All Levels</option>
					<option value="info">Info</option>
					<option value="warn">Warning</option>
					<option value="error">Error</option>
				</select>
			</div>
		</div>

		<div class="flex items-center">
			<!-- Column Picker -->
			<ColumnPicker columns={tableColumns} bind:visibleColumns={visibleColumns.current} />
		</div>

		<Boundary loading={logs.loading}>
			{@const _logs = logs.current}
			{#if _logs}
				<!-- Refresh (Right) -->
				<div class="flex w-full flex-col gap-2 md:ml-auto md:w-auto md:items-end">
					<button
						class="btn w-full btn-sm btn-primary md:w-auto"
						onclick={() => logs.refresh()}
						disabled={logs.loading}
					>
						<RefreshCw class="h-4 w-4 {logs.loading ? 'animate-spin' : ''}" />
						{logs.loading ? 'Refreshing…' : 'Refresh now'}
					</button>
				</div>
			{/if}
		</Boundary>
	</div>

	<!-- Logs Table -->
	<Boundary loading={logs.loading}>
		{@const _logs = logs.current}
		{#if _logs}
			<div class="rounded-box border border-base-300 bg-base-100 shadow">
				<div class="max-h-[60vh] overflow-auto">
					<DataTable
						items={_logs.logs.map((log) => ({ ...log, id: log.__key ?? String(log.timestamp) }))}
						columns={tableColumns}
						bind:visibleColumns={visibleColumns.current}
						showSearch={false}
						showPagination={true}
						{pageSize}
						bind:currentPage
						totalItems={_logs.totalFiltered}
						serverSidePagination={true}
						onPageChange={handlePageChange}
						emptyMessage="No logs found matching your criteria."
						tableClass="[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10"
						cellSnippets={{
							timestamp: timestampCell,
							level: levelCell,
							details: detailsCell
						}}
					/>
				</div>
			</div>
		{/if}
	</Boundary>
</div>
