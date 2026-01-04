<script lang="ts">
	import Header from '$cp/Header.svelte';
	import '$lib/app.css';
	import favicon from '$lib/assets/Favicon.png';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-linear-to-br from-sky-100 via-white to-purple-100">
	<div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
		<Header />

		<main class="flex flex-1 flex-col justify-center">
			{@render children?.()}
		</main>

		<footer class="mt-10 text-xs text-slate-500">
			&copy; {new Date().getFullYear()} BlockQuiz. Designed for curious minds aged 8–12.
		</footer>
	</div>
</div>
