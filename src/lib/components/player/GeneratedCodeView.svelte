<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
	import { ChevronDown, ChevronRight, Code2, Check, Copy } from '@lucide/svelte';

	type Props = {
		getCode: () => string;
		/**
		 * Refresh signal — change this value to force the view to re-read the
		 * generated code. Typically wired to the same key the player uses.
		 */
		refreshKey?: unknown;
	};

	let { getCode, refreshKey }: Props = $props();

	let open = $state(false);
	let code = $state('');
	let copied = $state(false);

	function recompute() {
		try {
			code = getCode().trim();
		} catch {
			code = '';
		}
	}

	$effect(() => {
		// Re-run on open or when refreshKey changes.
		void refreshKey;
		if (open) recompute();
	});

	function toggle() {
		open = !open;
		if (open) recompute();
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(code);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}
</script>

<div class="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm">
	<button
		type="button"
		class="flex w-full items-center justify-between gap-2 text-left"
		onclick={toggle}
		aria-expanded={open}
	>
		<span class="flex items-center gap-2 text-sm font-semibold">
			<Code2 class="h-4 w-4 text-primary" />
			{i18n.player_generated_code_title}
		</span>
		<span class="text-xs text-base-content/60">
			{open ? i18n.player_generated_code_close : i18n.player_generated_code_open}
		</span>
		{#if open}
			<ChevronDown class="h-4 w-4" />
		{:else}
			<ChevronRight class="h-4 w-4" />
		{/if}
	</button>

	{#if open}
		<p class="mt-2 text-xs text-base-content/65">{i18n.player_generated_code_hint}</p>
		{#if code}
			<div class="mt-3 flex justify-end">
				<button type="button" class="btn gap-1 btn-outline btn-xs" onclick={copy}>
					{#if copied}
						<Check class="h-3 w-3" />
						{i18n.player_generated_code_copied}
					{:else}
						<Copy class="h-3 w-3" />
						{i18n.player_generated_code_copy}
					{/if}
				</button>
			</div>
			<pre
				class="mt-2 overflow-x-auto rounded-lg bg-base-200 p-3 text-sm text-base-content/85"><code
					class="font-mono">{code}</code></pre>
		{:else}
			<p class="mt-3 text-sm text-base-content/55 italic">
				{i18n.player_generated_code_empty}
			</p>
		{/if}
	{/if}
</div>
