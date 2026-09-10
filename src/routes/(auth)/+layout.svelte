<script lang="ts">
	import Header from '$cp/Header.svelte';
	import '$lib/app.css';
	import favicon from '$lib/assets/favicon.png';
	import { i18n } from '$lib/i18n/index.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-base-100">
	<div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
		<Header />

		<main class="flex flex-1 flex-col justify-center">
			{@render children?.()}
		</main>

		<footer class="mt-10 text-xs text-base-content/60">
			&copy; {new Date().getFullYear()} BlockQuiz. {i18n.app_footer_tagline}
		</footer>
	</div>
</div>
