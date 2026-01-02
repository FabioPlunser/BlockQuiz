<script lang="ts">
	import { PersistedState } from 'runed';
	import Courses from './Courses.svelte';
	import Exercises from './Exercises.svelte';
	const possiblePages = [
		{ name: 'Courses', component: Courses },
		{ name: 'Exercises', component: Exercises }
	];
	let selectedPage = new PersistedState('selectedPage', possiblePages[0].name);
	let Page = $derived.by(() => {
		return possiblePages.find((page) => page.name === selectedPage.current)?.component;
	});
	$inspect(Page);
</script>

<div class="p-4">
	<div class="tabs-box tabs w-fit">
		{#each possiblePages as tab (tab)}
			<button
				class="tab"
				class:tab-active={selectedPage.current === tab.name}
				role="tab"
				onclick={() => {
					selectedPage.current = tab.name;
				}}
			>
				{tab.name}
			</button>
		{/each}
	</div>
</div>

<Page />
