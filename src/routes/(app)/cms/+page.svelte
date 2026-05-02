<script lang="ts">
	import { PersistedState } from 'runed';
	import { i18n } from '$lib/i18n/index.svelte';
	import Courses from './Courses.svelte';
	import Exercises from './Exercises.svelte';
	let possiblePages = $derived([
		{ id: 'courses', label: i18n.nav_courses, component: Courses },
		{ id: 'exercises', label: i18n.cms_exercises_tab, component: Exercises }
	]);
	let selectedPage = new PersistedState('selectedPage', 'courses');
	$effect(() => {
		if (!possiblePages.some((page) => page.id === selectedPage.current)) {
			selectedPage.current = 'courses';
		}
	});
	let Page = $derived.by(() => {
		return possiblePages.find((page) => page.id === selectedPage.current)?.component;
	});
</script>

<svelte:head>
	<title>{i18n.cms_title} | BlockQuiz</title>
</svelte:head>

<div class="p-4">
	<div class="tabs-box tabs w-fit">
		{#each possiblePages as tab (tab.id)}
			<button
				class="tab"
				class:tab-active={selectedPage.current === tab.id}
				role="tab"
				onclick={() => {
					selectedPage.current = tab.id;
				}}
			>
				{tab.label}
			</button>
		{/each}
	</div>
</div>

<Page />
