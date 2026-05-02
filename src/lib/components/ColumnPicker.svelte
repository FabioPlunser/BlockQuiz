<script lang="ts" generics="T extends { id: string }">
	import { Columns3, Check } from '@lucide/svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import type { Column } from './DataTable.svelte';

	type Props<T> = {
		columns: Column<T>[];
		visibleColumns: string[];
		onChange?: (columns: string[]) => void;
		class?: string;
	};

	let {
		columns,
		visibleColumns = $bindable(),
		onChange,
		class: className = ''
	}: Props<T> = $props();

	let isOpen = $state(false);

	function toggleColumn(key: string) {
		if (visibleColumns.includes(key)) {
			// Don't allow hiding all columns
			if (visibleColumns.length <= 1) return;
			visibleColumns = visibleColumns.filter((k) => k !== key);
		} else {
			visibleColumns = [...visibleColumns, key];
		}

		if (onChange) {
			onChange(visibleColumns);
		}
	}

	function selectAll() {
		visibleColumns = columns.filter((c) => !c.hidden).map((c) => c.key);
		if (onChange) {
			onChange(visibleColumns);
		}
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.column-picker-dropdown')) {
			isOpen = false;
		}
	}
</script>

<svelte:document onclick={handleClickOutside} />

<div class="column-picker-dropdown dropdown dropdown-end {className}">
	<button
		class="btn btn-ghost btn-sm"
		onclick={() => (isOpen = !isOpen)}
		title={i18n.column_picker_select_columns_title}
	>
		<Columns3 class="h-6 w-6" />
		<span class="hidden sm:inline">Columns</span>
	</button>

	{#if isOpen}
		<div
			class="dropdown-content menu z-50 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
		>
			<div class="mb-2 flex items-center justify-between px-2">
				<span class="text-sm font-medium">Visible Columns</span>
				<button class="btn btn-ghost btn-xs" onclick={selectAll}> Show All </button>
			</div>
			<div class="divider my-0"></div>
			<ul class="max-h-64 overflow-y-auto">
				{#each columns.filter((c) => !c.hidden) as column (column.key)}
					<li>
						<button
							class="flex items-center justify-between"
							onclick={() => toggleColumn(column.key)}
						>
							<span>{column.label}</span>
							{#if visibleColumns.includes(column.key)}
								<Check class="h-4 w-4 text-success" />
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
