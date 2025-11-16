<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { i18n, initI18n, setLocale } from '$lib/i18n/index.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	const languages = [
		{ code: 'en', label: 'English' },
		{ code: 'de', label: 'Deutsch' }
	] as const;

	onMount(async () => {
		// Initialize i18n with all available languages
		await initI18n([...languages]);
	});

	const changeLanguage = async (code: string) => {
		await setLocale(code);
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-linear-to-br from-sky-100 via-white to-purple-100">
	<div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
		<header class="mb-8 flex items-center justify-between">
			<a href="/" class="flex items-center gap-2 text-lg font-semibold text-slate-800">
				<span
					class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 text-xl font-bold text-white shadow-lg shadow-sky-200"
				>
					BQ
				</span>
				<span class="hidden sm:block">BlockQuiz</span>
			</a>
			<nav class="flex items-center gap-4 text-sm font-medium text-slate-600">
				<div class="dropdown dropdown-center">
					<button
						tabindex="0"
						class="btn btn-circle text-lg btn-ghost btn-sm"
						aria-label="Select language"
					>
						<i class="lni lni-globe-1 scale-150"></i>
					</button>
					<ul
						tabindex="-1"
						class="dropdown-content menu z-10 w-fit gap-1 rounded-lg bg-white p-2 shadow-lg"
					>
						{#each languages as lang}
							<li>
								<button
									onclick={() => changeLanguage(lang.code)}
									class={i18n.locale === String(lang.code) ? 'menu-active' : ''}
								>
									{lang.label}
								</button>
							</li>
						{/each}
					</ul>
				</div>
			</nav>
		</header>

		<main class="flex flex-1 flex-col justify-center">
			{@render children?.()}
		</main>

		<footer class="mt-10 text-xs text-slate-500">
			&copy; {new Date().getFullYear()} BlockQuiz. Designed for curious minds aged 8–12.
		</footer>
	</div>
</div>
