<script lang="ts">
	import { page } from '$app/state';
	import Loading from '$cp/Loading.svelte';
	import { getAuditLogs, type LogEntry, type LogLevelFilter } from '$remote/logs.remote';
	import { onMount, onDestroy, getAbortSignal } from 'svelte';
	import { fade } from 'svelte/transition';

	const pageSize = 25;

	let searchQuery = $state('');
	let selectedLevel = $state<LogLevelFilter>('all');
	let currentPage = $state(1);

	function goToPage(page: number, totalPages: number) {
		const target = Math.min(Math.max(page, 1), totalPages);
		currentPage = target;
	}

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

	async function getLogs() {
		return getAuditLogs({
			page: currentPage,
			pageSize,
			level: selectedLevel,
			search: searchQuery.trim()
		});
	}
</script>

<div class="container mx-auto space-y-6 p-6">
	<div
		class="flex flex-col gap-6 rounded-box bg-base-200/50 p-4 text-sm text-base-content/80 shadow-sm md:flex-row md:items-center md:gap-8"
	>
		<!-- Search + Filter (Left) -->
		<div class="flex w-full flex-col gap-2 md:max-w-md">
			<span class="text-xs font-semibold tracking-wide text-base-content/60 uppercase"
				>Search & Filter</span
			>
			<div class="flex flex-col gap-2 sm:flex-row">
				<label class="input-bordered input flex w-full items-center gap-2">
					<input type="text" class="grow" placeholder="Search logs..." bind:value={searchQuery} />
					<i class="lni lni-search-2"></i>
				</label>
				<select class="select-bordered select w-full sm:w-40" bind:value={selectedLevel}>
					<option value="all">All Levels</option>
					<option value="info">Info</option>
					<option value="warn">Warning</option>
					<option value="error">Error</option>
				</select>
			</div>
		</div>

		<svelte:boundary>
			{#snippet pending()}
				<Loading />
			{/snippet}
			{@const logs = await getLogs()}
			<!-- Pagination (Center) -->
			<div class="flex w-full flex-col items-center gap-3 text-xs md:flex-1">
				<span class="text-xs font-semibold tracking-wide text-base-content/60 uppercase"
					>Pagination</span
				>
				<div class="join">
					<button
						class="btn join-item btn-sm"
						disabled={currentPage === 1}
						onclick={() => goToPage(currentPage - 1, logs.totalPages)}
					>
						Prev
					</button>
					<button class="btn join-item btn-sm" disabled>
						Page {currentPage}
					</button>
					<button
						class="btn join-item btn-sm"
						disabled={currentPage === logs.totalPages}
						onclick={() => goToPage(currentPage + 1, logs.totalPages)}
					>
						Next
					</button>
				</div>
				<div class="text-[0.85rem] text-base-content/70">
					Showing page {currentPage} of {logs.totalPages} · {logs.totalFiltered} matching / {logs
						.logs.length} total
				</div>
			</div>

			<!-- Refresh (Right) -->
			<div class="flex w-full flex-col gap-2 md:w-auto md:items-end">
				<span class="text-xs font-semibold tracking-wide text-base-content/60 uppercase"
					>Refresh</span
				>
				<button
					class="btn w-full btn-sm btn-primary md:w-auto"
					onclick={() => logs.refresh()}
					disabled={logs.loading}
				>
					{logs.loading ? 'Refreshing…' : 'Refresh now'}
				</button>
			</div>
		</svelte:boundary>
	</div>

	<svelte:boundary>
		{#snippet pending()}
			<Loading />
		{/snippet}
		{@const logs = await getLogs()}
		<div class="rounded-box bg-base-100 shadow">
			<div class="max-h-[60vh] overflow-auto">
				<table class="table table-zebra">
					<thead>
						<tr>
							<th>Timestamp</th>
							<th>Level</th>
							<th>Message</th>
							<th>Details</th>
						</tr>
					</thead>
					<tbody>
						{#each logs.logs as log, index (index)}
							<tr transition:fade>
								<td class="font-mono text-xs whitespace-nowrap opacity-70">
									{new Date(log.timestamp).toLocaleString()}
								</td>
								<td>
									<div
										class="badge {getLevelBadgeClass(log.level)} gap-2 text-xs font-bold uppercase"
									>
										{log.level}
									</div>
								</td>
								<td class="font-medium">{log.message}</td>
								<td>
									<div class="collapse-arrow collapse rounded-box bg-base-300">
										<input type="checkbox" />
										<div class="collapse-title min-h-0 py-2 font-mono text-xs">View JSON</div>
										<div class="collapse-content">
											<pre class="overflow-x-auto p-2 text-xs"><code
													>{JSON.stringify(log, null, 2)}</code
												></pre>
										</div>
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="4" class="text-center py-8 opacity-50">
									No logs found matching your criteria.
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</svelte:boundary>
</div>
