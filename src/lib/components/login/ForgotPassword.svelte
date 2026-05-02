<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';

	let { onClose }: { onClose: () => void } = $props();
</script>

<div class="space-y-5">
	<h2 class="text-2xl font-semibold text-slate-900">
		{i18n.forgot_password_title}
	</h2>
	<div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
		<p>
			{i18n.forgot_password_unavailable_message}
		</p>
	</div>
	<div class="flex justify-start">
		<button class="btn btn-info" type="button" onclick={onClose}>
			{i18n.forgot_password_back}
		</button>
	</div>
</div>
