<script lang="ts">
	import RangeSlider from 'svelte-range-slider-pips';
	import { i18n } from '$lib/i18n/index.svelte';
	import { X, Download } from '@lucide/svelte';

	type ColumnKey =
		| 'timestamp'
		| 'category'
		| 'level'
		| 'action'
		| 'actorEmail'
		| 'actorUserId'
		| 'message'
		| 'details'
		| 'source';
	type CategoryKey = 'system' | 'admin' | 'user';

	type Props = {
		open: boolean;
		onClose: () => void;
		onExport: (input: {
			fromTs: number;
			toTs: number;
			categories: CategoryKey[];
			columns: ColumnKey[];
		}) => void | Promise<void>;
		exporting?: boolean;
	};

	let { open, onClose, onExport, exporting = false }: Props = $props();

	const ALL_COLUMNS: { key: ColumnKey; label: string }[] = [
		{ key: 'timestamp', label: 'Timestamp' },
		{ key: 'category', label: 'Category' },
		{ key: 'level', label: 'Level' },
		{ key: 'action', label: 'Action' },
		{ key: 'actorEmail', label: 'Actor email' },
		{ key: 'actorUserId', label: 'Actor user id' },
		{ key: 'message', label: 'Message' },
		{ key: 'details', label: 'Details (JSON)' },
		{ key: 'source', label: 'Source' }
	];
	const ALL_CATEGORIES: { key: CategoryKey; label: string }[] = [
		{ key: 'system', label: 'System' },
		{ key: 'admin', label: 'Admin' },
		{ key: 'user', label: 'User' }
	];

	const DAY_MS = 24 * 60 * 60 * 1000;
	const now = Date.now();
	const min = now - 365 * DAY_MS;
	const max = now;

	let range = $state<[number, number]>([now - 30 * DAY_MS, now]);
	let selectedColumns = $state<ColumnKey[]>([
		'timestamp',
		'category',
		'level',
		'action',
		'actorEmail',
		'message',
		'details'
	]);
	let selectedCategories = $state<CategoryKey[]>(['system', 'admin', 'user']);

	function formatDate(ts: number) {
		return new Date(ts).toLocaleString();
	}

	function toggleColumn(key: ColumnKey) {
		selectedColumns = selectedColumns.includes(key)
			? selectedColumns.filter((k) => k !== key)
			: [...selectedColumns, key];
	}
	function toggleCategory(key: CategoryKey) {
		selectedCategories = selectedCategories.includes(key)
			? selectedCategories.filter((k) => k !== key)
			: [...selectedCategories, key];
	}

	async function handleExport() {
		await onExport({
			fromTs: range[0],
			toTs: range[1],
			categories: selectedCategories,
			columns: selectedColumns
		});
	}

	function setQuickRange(days: number) {
		range = [now - days * DAY_MS, now];
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		role="presentation"
	>
		<div
			class="w-full max-w-2xl rounded-box bg-base-100 p-6 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-bold">{i18n.logs_export_csv}</h2>
				<button class="btn btn-ghost btn-sm btn-circle" onclick={onClose}>
					<X class="h-4 w-4" />
				</button>
			</div>

			<div class="space-y-6">
				<div>
					<div class="mb-2 flex items-center justify-between">
						<label class="text-sm font-medium">Date range</label>
						<div class="flex gap-1">
							<button class="btn btn-xs" onclick={() => setQuickRange(1)}>24h</button>
							<button class="btn btn-xs" onclick={() => setQuickRange(7)}>7d</button>
							<button class="btn btn-xs" onclick={() => setQuickRange(30)}>30d</button>
							<button class="btn btn-xs" onclick={() => setQuickRange(365)}>1y</button>
						</div>
					</div>
					<div class="logs-range px-2 pt-4 pb-2">
						<RangeSlider
							bind:values={range}
							{min}
							{max}
							step={DAY_MS}
							range
							pips
							pipstep={Math.round((max - min) / DAY_MS / 12)}
							formatter={(v: number) => new Date(v).toLocaleDateString()}
						/>
					</div>
					<div class="flex justify-between text-xs opacity-70">
						<span>{formatDate(range[0])}</span>
						<span>{formatDate(range[1])}</span>
					</div>
				</div>

				<div>
					<label class="mb-2 block text-sm font-medium">Categories</label>
					<div class="flex flex-wrap gap-2">
						{#each ALL_CATEGORIES as cat (cat.key)}
							<label class="flex cursor-pointer items-center gap-2 rounded border border-base-300 px-3 py-2 text-sm hover:bg-base-200">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={selectedCategories.includes(cat.key)}
									onchange={() => toggleCategory(cat.key)}
								/>
								{cat.label}
							</label>
						{/each}
					</div>
				</div>

				<div>
					<label class="mb-2 block text-sm font-medium">Columns</label>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each ALL_COLUMNS as col (col.key)}
							<label class="flex cursor-pointer items-center gap-2 rounded border border-base-300 px-3 py-2 text-sm hover:bg-base-200">
								<input
									type="checkbox"
									class="checkbox checkbox-sm"
									checked={selectedColumns.includes(col.key)}
									onchange={() => toggleColumn(col.key)}
								/>
								{col.label}
							</label>
						{/each}
					</div>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-2">
				<button class="btn" onclick={onClose}>Cancel</button>
				<button
					class="btn btn-primary"
					onclick={handleExport}
					disabled={exporting ||
						selectedColumns.length === 0 ||
						selectedCategories.length === 0}
				>
					<Download class="h-4 w-4" />
					{exporting ? i18n.logs_exporting : i18n.logs_export_csv}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.logs-range .rangeSlider) {
		--range-handle: var(--color-primary, #6366f1);
		--range-handle-focus: var(--color-primary, #6366f1);
		--range-range: var(--color-primary, #6366f1);
	}
</style>
