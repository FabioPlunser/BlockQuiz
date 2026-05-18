<script module lang="ts">
	import type { Snippet } from 'svelte';
	export type Column<T> = {
		key: string;
		label: string;
		render?: (item: T) => string | LocalizedString | { de: string; en: string } | undefined;
		html?: boolean;
		class?: string;
		sortable?: boolean;
		searchable?: boolean;
		hidden?: boolean;
		cellSnippet?: Snippet<[T, Column<T>]> | string; // Can be snippet or string key
	};
</script>

<script lang="ts" generics="T extends { id: string }">
	import type { LocalizedString } from '$lib/types/exercise';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import {
		Search,
		ChevronUp,
		ChevronDown,
		ChevronsUpDown,
		ChevronLeft,
		ChevronRight
	} from '@lucide/svelte';

	// Sort direction
	type SortDirection = 'asc' | 'desc' | null;

	type Props<T> = {
		items: T[];
		columns: Column<T>[];
		visibleColumns?: string[];
		searchQuery?: string;
		searchPlaceholder?: string;
		showSearch?: boolean;
		showPagination?: boolean;
		pageSize?: number;
		currentPage?: number;
		totalItems?: number;
		actions?: Snippet<[T]>;
		rowActions?: Snippet<[T]>;
		emptyMessage?: string;
		class?: string;
		tableClass?: string;
		sortKey?: string;
		sortDirection?: SortDirection;
		onSort?: (key: string, direction: SortDirection) => void;
		onPageChange?: (page: number) => void;
		serverSidePagination?: boolean;
		cellSnippets?: Record<string, Snippet<[T, Column<T>]>>; // Dictionary of snippets
	};

	let {
		items,
		columns,
		visibleColumns = $bindable(),
		searchQuery = $bindable(''),
		searchPlaceholder = undefined as string | undefined,
		showSearch = true,
		showPagination = true,
		pageSize = 10,
		currentPage = $bindable(1),
		totalItems,
		actions,
		rowActions,
		emptyMessage = undefined as string | undefined,
		class: className = '',
		tableClass = '',
		sortKey = $bindable(''),
		sortDirection = $bindable<SortDirection>(null),
		onSort,
		onPageChange,
		serverSidePagination = false,
		cellSnippets = {}
	}: Props<T> = $props();

	let resolvedSearchPlaceholder = $derived(searchPlaceholder ?? i18n.datatable_search_placeholder);
	let resolvedEmptyMessage = $derived(emptyMessage ?? i18n.datatable_no_items);

	// Get visible columns (filter by visibleColumns if provided)
	let displayColumns = $derived.by(() => {
		if (!visibleColumns || visibleColumns.length === 0) {
			return columns.filter((c) => !c.hidden);
		}
		return columns.filter((c) => visibleColumns.includes(c.key) && !c.hidden);
	});

	// Get cell value for search/sort
	function getCellValue(item: T, column: Column<T>): string {
		const value = column.render
			? column.render(item)
			: (item as Record<string, unknown>)[column.key];

		if (!value) return '';

		// Handle LocalizedString
		if (typeof value === 'object' && 'de' in value && 'en' in value) {
			return getLocalized(value as LocalizedString);
		}

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

		// Otherwise, look it up in cellSnippets dictionary
		return cellSnippets[column.cellSnippet];
	}

	// Filter items by search query (client-side)
	let searchedItems = $derived.by(() => {
		if (!searchQuery.trim() || serverSidePagination) return items;

		const query = searchQuery.toLowerCase();
		return items.filter((item) => {
			return columns.some((column) => {
				if (column.searchable === false) return false;
				const value = getCellValue(item, column);
				return value.toLowerCase().includes(query);
			});
		});
	});

	// Sort items (client-side)
	let sortedItems = $derived.by(() => {
		if (!sortKey || !sortDirection || serverSidePagination) return searchedItems;

		const column = columns.find((c) => c.key === sortKey);
		if (!column) return searchedItems;

		return [...searchedItems].sort((a, b) => {
			const aValue = getCellValue(a, column);
			const bValue = getCellValue(b, column);

			const comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
			return sortDirection === 'asc' ? comparison : -comparison;
		});
	});

	// Paginate items (client-side)
	let paginatedItems = $derived.by(() => {
		if (!showPagination || serverSidePagination) return sortedItems;

		const start = (currentPage - 1) * pageSize;
		return sortedItems.slice(start, start + pageSize);
	});

	// Calculate total pages
	let itemCount = $derived(
		serverSidePagination ? (totalItems ?? items.length) : sortedItems.length
	);
	let totalPages = $derived(Math.ceil(itemCount / pageSize));

	// Handle sort click
	function handleSort(column: Column<T>) {
		if (!column.sortable) return;

		let newDirection: SortDirection;
		if (sortKey !== column.key) {
			newDirection = 'asc';
		} else if (sortDirection === 'asc') {
			newDirection = 'desc';
		} else {
			newDirection = null;
		}

		sortKey = newDirection ? column.key : '';
		sortDirection = newDirection;

		if (onSort) {
			onSort(column.key, newDirection);
		}
	}

	// Handle page change
	function goToPage(page: number) {
		if (page < 1 || page > totalPages) return;
		currentPage = page;
		if (onPageChange) {
			onPageChange(page);
		}
	}

	// Generate page numbers for pagination
	let pageNumbers = $derived.by(() => {
		const pages: (number | '...')[] = [];
		const maxVisible = 5;

		if (totalPages <= maxVisible) {
			for (let i = 1; i <= totalPages; i++) {
				pages.push(i);
			}
		} else {
			pages.push(1);

			if (currentPage > 3) {
				pages.push('...');
			}

			const start = Math.max(2, currentPage - 1);
			const end = Math.min(totalPages - 1, currentPage + 1);

			for (let i = start; i <= end; i++) {
				pages.push(i);
			}

			if (currentPage < totalPages - 2) {
				pages.push('...');
			}

			pages.push(totalPages);
		}

		return pages;
	});
</script>

<!-- Default cell snippet for simple text rendering -->
{#snippet defaultCell(item: T, column: Column<T>)}
	{@const value = getCellValue(item, column)}
	{#if column.html}
		<span>{@html sanitizeHtml(value)}</span>
	{:else}
		<span>{value}</span>
	{/if}
{/snippet}

<div class="flex flex-col gap-4 {className}">
	<!-- Toolbar -->
	{#if showSearch || actions}
		<div class="flex flex-wrap items-center gap-2">
			{#if showSearch}
				<label class="input-bordered input input-sm flex items-center gap-2">
					<Search class="h-4 w-4 opacity-60" />
					<input
						type="search"
						class="grow"
						placeholder={resolvedSearchPlaceholder}
						bind:value={searchQuery}
					/>
				</label>
			{/if}

			<div class="flex-1"></div>

			{#if actions}
				{@render actions(items[0])}
			{/if}
		</div>
	{/if}

	<!-- Table -->
	<div class="overflow-x-auto rounded-lg border border-base-300 {tableClass}">
		<table class="table table-zebra">
			<thead class="bg-base-200">
				<tr>
					{#each displayColumns as column (column.key)}
						<th
							class="{column.class ?? ''} {column.sortable
								? 'cursor-pointer select-none hover:bg-base-300'
								: ''}"
							onclick={() => handleSort(column)}
						>
							<div class="flex items-center gap-1">
								<span>{column.label}</span>
								{#if column.sortable}
									{#if sortKey === column.key && sortDirection === 'asc'}
										<ChevronUp class="h-4 w-4" />
									{:else if sortKey === column.key && sortDirection === 'desc'}
										<ChevronDown class="h-4 w-4" />
									{:else}
										<ChevronsUpDown class="h-4 w-4 opacity-40" />
									{/if}
								{/if}
							</div>
						</th>
					{/each}
					{#if rowActions}
						<th class="w-px whitespace-nowrap text-right">
							{i18n.datatable_actions_header}
						</th>
					{/if}
				</tr>
			</thead>
			<tbody>
				{#each paginatedItems as item (item.id)}
					<tr class="hover">
						{#each displayColumns as column (column.key)}
							{@const snippet = getCellSnippet(column)}
							<td class={column.class}>
								{@render (snippet ?? defaultCell)(item, column)}
							</td>
						{/each}
						{#if rowActions}
							<td class="w-px whitespace-nowrap">
								<div class="flex justify-end gap-2">
									{@render rowActions(item)}
								</div>
							</td>
						{/if}
					</tr>
				{:else}
					<tr>
						<td
							colspan={displayColumns.length + (rowActions ? 1 : 0)}
							class="py-8 text-center text-base-content/60"
						>
							{resolvedEmptyMessage}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if showPagination && totalPages > 1}
		<div class="flex items-center justify-between">
			<div class="text-sm text-base-content/60">
				Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, itemCount)} of
				{itemCount} items
			</div>
			<div class="join">
				<button
					class="btn join-item btn-sm"
					disabled={currentPage === 1}
					onclick={() => goToPage(currentPage - 1)}
				>
					<ChevronLeft class="h-4 w-4" />
				</button>
				{#each pageNumbers as page, i (i)}
					{#if page === '...'}
						<button class="btn btn-disabled join-item btn-sm">...</button>
					{:else}
						<button
							class="btn join-item btn-sm"
							class:btn-active={currentPage === page}
							onclick={() => goToPage(page)}
						>
							{page}
						</button>
					{/if}
				{/each}
				<button
					class="btn join-item btn-sm"
					disabled={currentPage === totalPages}
					onclick={() => goToPage(currentPage + 1)}
				>
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>
		</div>
	{/if}
</div>
