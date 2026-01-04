<script lang="ts">
	import type { Toast } from '../core/types';
	import type { Component } from 'svelte';

	let { toast }: { toast: Toast } = $props();
</script>

<div class="message" {...toast.ariaProps}>
	{#if typeof toast.message === 'string'}
		{toast.message}
	{:else if toast.message}
		{@const MessageComponent = toast.message as Component<{ toast: Toast }>}
		<MessageComponent {toast} />
	{/if}
</div>

<style>
	.message {
		display: flex;
		justify-content: center;
		margin: 4px 10px;
		color: inherit;
		flex: 1 1 auto;
		white-space: pre-line;
	}
</style>

