<script lang="ts">
	import Header from '$cp/Header.svelte';
	import favicon from '$lib/assets/Favicon.png';
	let { children } = $props();
</script>

<svelte:head>
	<title>BlockQuiz</title>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="mx-auto flex min-h-screen w-full flex-col px-4 py-10 sm:px-6 lg:px-8">
	<Header />

	<main class="flex flex-1 flex-col">
		{@render children?.()}
	</main>

	<footer class="mt-10 text-center text-xs text-slate-500">
		&copy; {new Date().getFullYear()} BlockQuiz. Designed for curious minds aged 8–12.
	</footer>
</div>
