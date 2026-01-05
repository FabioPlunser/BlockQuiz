<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		loading?: boolean;
	};

	let { children, loading = false }: Props = $props();
</script>

<svelte:boundary onerror={(error) => console.error(error)}>
	{#snippet failed(error, reset)}
		<button class="btn btn-error" onclick={reset}>oops! try again {error}</button>
	{/snippet}
	{#snippet pending()}
		<div class="flex w-full justify-center">
			<span class="loading loading-xl loading-bars text-4xl text-primary"></span>
		</div>
	{/snippet}
	{#if loading}
		<div class="flex w-full justify-center">
			<span class="loading loading-xl loading-bars text-4xl text-primary"></span>.
		</div>
	{:else}
		{@render children?.()}
	{/if}
</svelte:boundary>
