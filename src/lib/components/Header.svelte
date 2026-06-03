<script lang="ts">
	import { i18n, setLocale } from '$lib/i18n/index.svelte';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getCurrentUser } from '$remote/auth.remote';
	import { theme, type Theme } from '$lib/theme.svelte';
	import Navigation from './Navigation.svelte';
	import Avatar from './Avatar.svelte';
	import { Globe, Sun, Moon, Coffee } from '@lucide/svelte';

	const themeOptions: ReadonlyArray<{ value: Theme; label: string; icon: typeof Sun }> = [
		{ value: 'light', label: 'Light', icon: Sun },
		{ value: 'dark', label: 'Dark', icon: Moon },
		{ value: 'warm', label: 'Warm', icon: Coffee }
	];

	const languages = $derived([
		{ code: 'en', label: i18n.language_english },
		{ code: 'de', label: i18n.language_german }
	] as const);

	const userQuery = getCurrentUser();
	const user = $derived(userQuery.current);

	onMount(() => {
		theme.sync();
		userQuery.refresh().catch(() => {});
	});

	const changeLanguage = async (code: string) => {
		await setLocale(code);
	};
</script>

<header class="mb-8 flex items-center justify-between">
	<a href={resolve('/')} class="flex items-center gap-2 text-lg font-semibold">
		<span
			class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-xl font-bold text-white"
		>
			BQ
		</span>
		<span class="hidden sm:block">BlockQuiz</span>
	</a>

	<nav class="{user ? 'flex w-full' : ''} items-center gap-2 text-sm font-medium">
		{#if user}
			<div class="mx-auto flex items-center">
				<Navigation />
			</div>
			<div class="flex gap-2">
				<h1 class="flex items-center">{user.role}</h1>
				<h1 class="flex items-center">{user.email}</h1>
				<Avatar />
			</div>
		{/if}

		<div class="flex items-center gap-3">
			<div class="dropdown-hover dropdown dropdown-end">
				<button
					tabindex="0"
					class="btn btn-circle text-lg btn-ghost btn-sm"
					aria-label={i18n.theme_toggle_label}
					title={i18n.theme_toggle_label}
				>
					{#if theme.current === 'dark'}
						<Moon class="h-5 w-5" />
					{:else if theme.current === 'warm'}
						<Coffee class="h-5 w-5" />
					{:else}
						<Sun class="h-5 w-5" />
					{/if}
				</button>
				<ul
					tabindex="-1"
					class="dropdown-content menu z-10 mt-1 w-36 gap-1 rounded-xl bg-base-100 p-2 shadow-md"
				>
					{#each themeOptions as opt (opt.value)}
						<li>
							<button
								onclick={() => theme.set(opt.value)}
								class={theme.current === opt.value ? 'menu-active' : ''}
							>
								<opt.icon class="h-4 w-4" />
								{opt.label}
							</button>
						</li>
					{/each}
				</ul>
			</div>

			<div class="dropdown-hover dropdown dropdown-center">
				<button
					tabindex="0"
					class="btn btn-circle text-lg btn-ghost btn-sm"
					aria-label={i18n.language_select}
				>
					<Globe class="h-5 w-5" />
				</button>
				<ul
					tabindex="-1"
					class="dropdown-content menu z-10 w-fit gap-1 rounded-xl bg-white p-2 shadow-md"
				>
					{#each languages as lang (lang.code)}
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
		</div>
	</nav>
</header>
