<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '@iconify/svelte';
	import { Search } from '@lucide/svelte';

	type Props = {
		viewMode?: 'cards' | 'table';
		searchQuery?: string;
		searchPlaceholder?: string;
		showViewToggle?: boolean;
		showSearch?: boolean;
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
		createButtonLabel = 'Add Item',
		onCreate,
		filters,
		actions
	}: Props = $props();

	const views = [
		{ name: 'cards' as const, icon: 'ic:round-grid-view' },
		{ name: 'table' as const, icon: 'ic:outline-table-chart' }
	];
</script>

<div class="flex flex-wrap items-center gap-2 p-2">
	<!-- View Toggle -->
	{#if showViewToggle}
		<div class="flex gap-1">
			{#each views as view (view.name)}
				<button
					class="btn btn-ghost btn-sm"
					class:btn-active={viewMode === view.name}
					onclick={() => (viewMode = view.name)}
					title={view.name === 'cards' ? 'Card View' : 'Table View'}
				>
					<Icon icon={view.icon} class="text-2xl" />
				</button>
			{/each}
		</div>
	{/if}

	<!-- Search -->
	{#if showSearch}
		<label class="input-bordered input input-sm bg-base-200">
			<Search size={16} />
			<input
				type="search"
				class="grow"
				placeholder={searchPlaceholder}
				bind:value={searchQuery}
			/>
		</label>
	{/if}

	<!-- Additional Filters -->
	{#if filters}
		{@render filters()}
	{/if}

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Create Button -->
	{#if onCreate}
		<button class="btn items-center btn-sm btn-primary" onclick={onCreate}>
			<Icon icon="ic:round-add" class="text-xl" />
			{createButtonLabel}
		</button>
	{/if}

	<!-- Additional Actions -->
	{#if actions}
		{@render actions()}
	{/if}
</div>
