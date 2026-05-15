<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';

	type Props = {
		onRetry: () => void;
	};
	let { onRetry }: Props = $props();
</script>

<div
	role="alert"
	class="flex items-start gap-3 rounded-xl border border-error/40 bg-error/10 p-3 text-sm"
>
	<div class="text-2xl leading-none" aria-hidden="true">🧱</div>
	<div class="min-w-0 flex-1">
		<div class="font-semibold text-error-content">
			{i18n.player_collision_title ?? 'Ouch! You ran into a wall.'}
		</div>
		<p class="mt-0.5 text-base-content/70">
			{i18n.player_collision_hint ?? 'Move your turtle around the walls and try again.'}
		</p>
	</div>
	<button class="btn btn-sm btn-error" onclick={onRetry}>
		{i18n.player_collision_retry ?? 'Try again'}
	</button>
</div>
