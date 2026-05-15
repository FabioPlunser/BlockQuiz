<script lang="ts">
	import type { Snippet } from 'svelte';
	import { LayoutGrid, Table, Search, Plus } from '@lucide/svelte';
	import ColumnPicker from '$lib/components/ColumnPicker.svelte';
	import type { Column } from '$lib/components/DataTable.svelte';
	import { i18n } from '$lib/i18n/index.svelte';

	type Props = {
		viewMode?: 'cards' | 'table';
		searchQuery?: string;
		searchPlaceholder?: string;
		showViewToggle?: boolean;
		showSearch?: boolean;
		showColumnPicker?: boolean;
		columns?: Column<any>[];
		visibleColumns?: string[];
		createButtonLabel?: string;
		onCreate?: () => void;
		filters?: Snippet;
		actions?: Snippet;
	};

	let {
		viewMode = $bindable('cards'),
		searchQuery = $bindable(''),
		searchPlaceholder = 'Search...',
		showViewToggle = true,
		showSearch = true,
		showColumnPicker = false,
		columns = [],
		visibleColumns = $bindable([]),
		createButtonLabel = 'Add Item',
		onCreate,
		filters,
		actions
	}: Props = $props();
</script>

<div class="flex flex-wrap items-center gap-3 p-2">
	<!-- View Toggle -->
	{#if showViewToggle}
		<div class="join">
			<button
				type="button"
				class="btn join-item btn-md"
				class:btn-active={viewMode === 'cards'}
				onclick={() => (viewMode = 'cards')}
				title={i18n.cms_view_cards ?? 'Card view'}
				aria-label={i18n.cms_view_cards ?? 'Card view'}
				aria-pressed={viewMode === 'cards'}
			>
				<LayoutGrid class="h-5 w-5" />
			</button>
			<button
				type="button"
				class="btn join-item btn-md"
				class:btn-active={viewMode === 'table'}
				onclick={() => (viewMode = 'table')}
				title={i18n.cms_view_table ?? 'Table view'}
				aria-label={i18n.cms_view_table ?? 'Table view'}
				aria-pressed={viewMode === 'table'}
			>
				<Table class="h-5 w-5" />
			</button>
		</div>
	{/if}

	<!-- Search -->
	{#if showSearch}
		<label class="input-bordered input input-md min-w-[18rem] flex-1 bg-base-200 sm:flex-none">
			<Search class="h-5 w-5" />
			<input type="search" class="grow" placeholder={searchPlaceholder} bind:value={searchQuery} />
		</label>
	{/if}

	<!-- Column Picker (only shown in table view) -->
	{#if showColumnPicker && viewMode === 'table' && columns.length > 0}
		<ColumnPicker {columns} bind:visibleColumns />
	{/if}

	<!-- Additional Filters -->
	{#if filters}
		{@render filters()}
	{/if}

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Create Button -->
	{#if onCreate}
		<button class="btn items-center gap-2 btn-md btn-primary" onclick={onCreate}>
			<Plus class="h-5 w-5" />
			{createButtonLabel}
		</button>
	{/if}

	<!-- Additional Actions -->
	{#if actions}
		{@render actions()}
	{/if}
</div>
