<!-- <script lang="ts">
	import Navigation from '$lib/components/Navigation.svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { data } = $props();

	// Redirect authenticated users to courses
	onMount(() => {
		if (data.user) {
			goto('/courses');
		}
	});
</script>

{#if data.user}
	<div class="container mx-auto">
		<Navigation userRole={data.user.role} />
	</div>
{:else}
	<div class="text-center">
		<h1 class="mb-4 text-4xl font-bold text-slate-800 sm:text-5xl">
			{i18n.t('welcome_title')}
		</h1>
		<p class="mb-8 text-lg text-slate-600">{i18n.t('welcome_description')}</p>

		<div class="flex flex-col gap-4 sm:flex-row sm:justify-center">
			<a href="/login" class="btn btn-lg btn-primary">
				{i18n.t('login_submit_button')}
			</a>
			<a href="/demo" class="btn btn-outline btn-lg">
				{i18n.t('explore_as_guest')}
			</a>
		</div>
	</div>
{/if} -->

<h1>Hallo</h1>
