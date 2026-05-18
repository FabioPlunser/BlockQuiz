<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		description?: string;
		actionLabel?: string;
		onAction?: () => void;
		secondaryLabel?: string;
		onSecondary?: () => void;
		icon?: Snippet;
	};

	let {
		title,
		description,
		actionLabel,
		onAction,
		secondaryLabel,
		onSecondary,
		icon
	}: Props = $props();
</script>

<div
	class="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed border-base-300 bg-base-100/60 px-8 py-12 text-center"
>
	{#if icon}
		<div
			class="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary"
			aria-hidden="true"
		>
			{@render icon()}
		</div>
	{/if}

	<div class="space-y-1">
		<h3 class="text-lg font-semibold">{title}</h3>
		{#if description}
			<p class="text-sm text-base-content/65">{description}</p>
		{/if}
	</div>

	{#if actionLabel || secondaryLabel}
		<div class="mt-1 flex flex-wrap items-center justify-center gap-2">
			{#if actionLabel}
				<button class="btn btn-primary" onclick={onAction}>{actionLabel}</button>
			{/if}
			{#if secondaryLabel}
				<button class="btn btn-ghost" onclick={onSecondary}>{secondaryLabel}</button>
			{/if}
		</div>
	{/if}
</div>
