<script lang="ts" generics="T extends { id: string }">
	import type { Snippet } from 'svelte';
	import { fly } from 'svelte/transition';

	type Props<T> = {
		items: T[];
		card: Snippet<[T, number]>;
		class?: string;
	};

	let { items, card, class: className = '' }: Props<T> = $props();
</script>

<div class="flex flex-col items-stretch gap-4 sm:grid sm:grid-cols-2 md:grid-cols-3 {className}">
	{#each items as item, i (item.id)}
		<div class="h-full" in:fly={{ y: -200, duration: 300, delay: i * 50 }}>
			{@render card(item, i)}
		</div>
	{/each}
</div>
