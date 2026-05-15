<script lang="ts">
	import type { Snippet } from 'svelte';
	import Loading from './Loading.svelte';

	type Props = {
		children: Snippet;
	};

	let { children }: Props = $props();
</script>

<svelte:boundary>
	{#if $effect.pending()}
		<Loading />
	{:else}
		{@render children?.()}
	{/if}

	{#snippet pending()}
		<Loading />
	{/snippet}
</svelte:boundary>
