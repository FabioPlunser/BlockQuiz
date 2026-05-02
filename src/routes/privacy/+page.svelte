<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
</script>

<svelte:head>
	<title>{i18n.privacy_title} | BlockQuiz</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-6">
	<h1 class="text-3xl font-bold">{i18n.privacy_title}</h1>
	<p class="mt-4 text-base-content/80">{i18n.privacy_text}</p>
</div>
