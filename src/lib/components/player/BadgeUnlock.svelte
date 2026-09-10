<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
	import { fly } from 'svelte/transition';
	import type { BadgeKey } from '$lib/achievements/rules';
	import { BADGE_META } from '$lib/achievements/meta';

	type Props = {
		badges: BadgeKey[];
		onDismiss: () => void;
	};

	let { badges, onDismiss }: Props = $props();

	function lookup(key: string, fallback: string): string {
		return (i18n as Record<string, string | undefined>)[key] ?? fallback;
	}
</script>

{#if badges.length > 0}
	<div
		in:fly={{ y: -20, duration: 250 }}
		out:fly={{ y: -20, duration: 200 }}
		class="fixed inset-x-0 top-4 z-[1000] mx-auto max-w-md px-4"
	>
		<div class="rounded-2xl border border-success bg-base-100 p-4 shadow-2xl">
			<div class="text-center">
				<p class="text-xs font-semibold tracking-[0.18em] text-success uppercase">
					{i18n.badge_unlock_title}
				</p>
			</div>
			<ul class="mt-3 space-y-2">
				{#each badges as key (key)}
					{@const meta = BADGE_META[key]}
					<li class="flex items-start gap-3 rounded-xl bg-success/10 p-3">
						<span class="text-2xl" aria-hidden="true">{meta?.emoji ?? '🏅'}</span>
						<div class="flex-1">
							<div class="font-semibold">
								{lookup(meta?.titleKey ?? '', key)}
							</div>
							<p class="text-sm text-base-content/70">
								{lookup(meta?.descriptionKey ?? '', '')}
							</p>
						</div>
					</li>
				{/each}
			</ul>
			<div class="mt-3 flex justify-end">
				<button class="btn btn-sm btn-primary" type="button" onclick={onDismiss}>
					{i18n.badge_unlock_dismiss}
				</button>
			</div>
		</div>
	</div>
{/if}
