<script lang="ts">
	import { PersistedState } from 'runed';
	import { i18n } from '$lib/i18n/index.svelte';
	import { BookOpen, ListChecks } from '@lucide/svelte';
	import Courses from './Courses.svelte';
	import Exercises from './Exercises.svelte';

	const possiblePages = [
		{ id: 'courses' as const, component: Courses, icon: BookOpen },
		{ id: 'exercises' as const, component: Exercises, icon: ListChecks }
	];

	let selectedPage = new PersistedState<'courses' | 'exercises'>('selectedPage', 'courses');

	$effect(() => {
		if (!possiblePages.some((page) => page.id === selectedPage.current)) {
			selectedPage.current = 'courses';
		}
	});

	const labelFor = (id: 'courses' | 'exercises') =>
		id === 'courses' ? i18n.nav_courses : i18n.cms_exercises_tab;
</script>

<svelte:head>
	<title>{i18n.cms_title} | BlockQuiz</title>
</svelte:head>

<div class="p-4">
	<div class="tabs-box tabs w-fit" role="tablist">
		{#each possiblePages as tab (tab.id)}
			{@const Icon = tab.icon}
			<button
				class="tab gap-2"
				class:tab-active={selectedPage.current === tab.id}
				role="tab"
				aria-selected={selectedPage.current === tab.id}
				onclick={() => {
					selectedPage.current = tab.id;
				}}
			>
				<Icon class="h-4 w-4" />
				{labelFor(tab.id)}
			</button>
		{/each}
	</div>
</div>

{#if selectedPage.current === 'courses'}
	<Courses />
{:else if selectedPage.current === 'exercises'}
	<Exercises />
{/if}
