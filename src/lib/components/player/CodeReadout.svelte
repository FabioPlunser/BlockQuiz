<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
	import { describeWorkspace, type ReadoutLocale } from '$lib/blockly/codeReadout';
	import { ChevronDown, ChevronRight, BookOpenText } from '@lucide/svelte';

	type Props = {
		getXml: () => string;
		/**
		 * Refresh signal — change this value to force the readout to re-read the
		 * workspace XML. Typically wired to the same key the player uses.
		 */
		refreshKey?: unknown;
	};

	let { getXml, refreshKey }: Props = $props();

	let open = $state(false);
	let lines = $state<string[]>([]);

	const localeOf = (): ReadoutLocale => (i18n.locale === 'de' ? 'de' : 'en');

	function recompute() {
		try {
			lines = describeWorkspace(getXml(), localeOf());
		} catch {
			lines = [];
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
</script>

<div class="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm">
	<button
		type="button"
		class="flex w-full items-center justify-between gap-2 text-left"
		onclick={toggle}
		aria-expanded={open}
	>
		<span class="flex items-center gap-2 text-sm font-semibold">
			<BookOpenText class="h-4 w-4 text-primary" />
			{i18n.player_code_readout_title}
		</span>
		<span class="text-xs text-base-content/60">
			{open ? i18n.player_code_readout_close : i18n.player_code_readout_open}
		</span>
		{#if open}
			<ChevronDown class="h-4 w-4" />
		{:else}
			<ChevronRight class="h-4 w-4" />
		{/if}
	</button>

	{#if open}
		<p class="mt-2 text-xs text-base-content/65">{i18n.player_code_readout_hint}</p>
		<ol class="mt-3 space-y-1 text-sm text-base-content/85">
			{#each lines as line, index (index)}
				<li class="font-mono whitespace-pre">{line}</li>
			{/each}
		</ol>
		<button type="button" class="btn mt-3 btn-outline btn-xs" onclick={recompute}> ↻ </button>
	{/if}
</div>
