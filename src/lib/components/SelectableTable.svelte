<script lang="ts" generics="T extends { id: string }">
	import { Search } from '@lucide/svelte';
	import type { LocalizedString } from '$lib/types/exercise';
	import { getLocalized } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import type { Snippet } from 'svelte';

	type Column<T> = {
		key: string;
		label: string;
		render?: (item: T) => string | LocalizedString | { de: string; en: string } | undefined;
		html?: boolean; // If true, render as HTML
		class?: string;
		cellSnippet?: Snippet<[T, Column<T>]> | string;
	};

	type Props<T> = {
		items: T[];
		columns: Column<T>[];
		searchQuery?: string;
		searchPlaceholder?: string;
		showSearch?: boolean;
		showSelectAll?: boolean;
		selectedIds?: string[];
		onSelect?: (item: T) => void;
		onSelectAll?: () => void;
		class?: string;
		tableClass?: string;
		cellSnippets?: Record<string, Snippet<[T, Column<T>]>>; // Dictionary of snippets
	};

	let {
		items = $bindable(),
		columns = $bindable(),
		searchQuery = $bindable(''),
		searchPlaceholder = 'Search',
		showSearch = true,
		showSelectAll = true,
		selectedIds = $bindable([]),
		onSelect,
		onSelectAll,
		class: className = '',
		tableClass = '',
		cellSnippets = {} // Dictionary of snippets
	}: Props<T> = $props();

	function isSelected(item: T): boolean {
		return selectedIds.includes(item.id);
	}

	function allSelected(): boolean {
		return items.length > 0 && items.every((item) => selectedIds.includes(item.id));
	}

	function handleSelect(item: T) {
		if (onSelect) {
			onSelect(item);
		} else {
			// Default toggle behavior
			if (isSelected(item)) {
				selectedIds = selectedIds.filter((id) => id !== item.id);
			} else {
				selectedIds = [...selectedIds, item.id];
			}
		}
	}

	function handleSelectAll() {
		if (onSelectAll) {
			onSelectAll();
		} else {
			// Default toggle all behavior
			if (allSelected()) {
				selectedIds = [];
			} else {
				selectedIds = items.map((item) => item.id);
			}
		}
	}

	function renderCell(item: T, column: Column<T>): string {
		const value = column.render ? column.render(item) : (item as any)[column.key];

		if (!value) return '';

		// Handle LocalizedString
		if (typeof value === 'object' && 'de' in value && 'en' in value) {
			return getLocalized(value as LocalizedString);
		}

		// Handle other types
		if (typeof value === 'string') {
			return value;
		}

		return String(value);
	}
	// Resolve cell snippet - either direct snippet or lookup by key
	function getCellSnippet(column: Column<T>): Snippet<[T, Column<T>]> | undefined {
		if (!column.cellSnippet) return undefined;

		// If it's already a snippet, return it
		if (typeof column.cellSnippet !== 'string') {
			return column.cellSnippet;
		}
		console.log(column);
		console.log(cellSnippets);
		// Otherwise, look it up in cellSnippets dictionary
		return cellSnippets[column.cellSnippet];
	}
</script>

{#snippet defaultSnippet(exercise)}
	<span>Error rendering snippet</span>
{/snippet}

<div class={className}>
	{#if showSearch}
		<label class="input-bordered input input-sm mb-4 w-full">
			<Search />
			<input type="search" class="grow" placeholder={searchPlaceholder} bind:value={searchQuery} />
		</label>
	{/if}

	<div class="overflow-x-auto">
		<table class="table {tableClass}">
			<thead>
				<tr>
					{#if showSelectAll}
						<th>
							<label>
								<input
									type="checkbox"
									class="checkbox checkbox-primary"
									checked={allSelected()}
									onclick={handleSelectAll}
								/>
							</label>
						</th>
					{/if}
					{#each columns as column, i (i)}
						<th class={column.class}>{column.label}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each items as item (item.id)}
					<tr>
						{#if showSelectAll}
							<th>
								<label>
									<input
										type="checkbox"
										class="checkbox checkbox-primary"
										checked={isSelected(item)}
										onclick={() => handleSelect(item)}
									/>
								</label>
							</th>
						{/if}
						{#each columns as column, i (i)}
							{@const snippet = getCellSnippet(column)}
							<td class={column.class}>
								{#if column.cellSnippet}
									{@render (snippet ?? defaultSnippet)(item, column)}
								{:else if column.html}
									<span>{@html sanitizeHtml(renderCell(item, column))}</span>
								{:else}
									<span>{renderCell(item, column)}</span>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
