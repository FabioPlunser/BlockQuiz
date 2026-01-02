<script lang="ts" generics="T extends { id: string }">
	import type { Snippet } from 'svelte';
	import { fly } from 'svelte/transition';

	type Props<T> = {
		items: T[];
		card: Snippet<[T, number]>;
		gridCols?: 1 | 2 | 3 | 4;
		class?: string;
	};

	let { items, card, gridCols = 3, class: className = '' }: Props<T> = $props();

	const gridClasses = {
		1: 'grid-cols-1',
		2: 'grid-cols-2',
		3: 'grid-cols-3',
		4: 'grid-cols-4'
	};
</script>

<div class="grid gap-4 {gridClasses[gridCols]} {className}">
	{#each items as item, i (item.id)}
		<div in:fly={{ y: -200, duration: 300, delay: i * 50 }}>
			{@render card(item, i)}
		</div>
	{/each}
</div>

