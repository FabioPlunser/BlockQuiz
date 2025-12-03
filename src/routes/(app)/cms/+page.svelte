<script lang="ts">
	import Icon from '@iconify/svelte';
	import { PersistedState } from 'runed';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	// --------------------------------------------------------------------------------
	// --------------------------------------------------------------------------------
	let searchParams = $derived(page.url.searchParams);

	let courseId = $derived(Number(searchParams.get('courseId')));
	let exerciseId = $derived(Number(searchParams.get('exerciseId')));
	// --------------------------------------------------------------------------------
	// --------------------------------------------------------------------------------
	const possiblePages = ['Courses', 'Exercises'];
	const currentPage = new PersistedState('Pages', 'Courses');
	const currentView = new PersistedState('UserView', 'Cards');
	// -------------------------------------------------------------------------------
	// --------------------------------------------------------------------------------
	const tempCourses = [
		{ id: 1, name: 'Course 1', description: 'Description 1', exercises: 10 },
		{ id: 2, name: 'Course 2', description: 'Description 2', exercises: 20 },
		{ id: 3, name: 'Course 3', description: 'Description 3', exercises: 30 },
		{ id: 4, name: 'Course 4', description: 'Description 4', exercises: 40 },
		{ id: 5, name: 'Course 5', description: 'Description 5', exercises: 50 },
		{ id: 6, name: 'Course 6', description: 'Description 6', exercises: 60 },
		{ id: 7, name: 'Course 7', description: 'Description 7', exercises: 70 },
		{ id: 8, name: 'Course 8', description: 'Description 8', exercises: 80 },
		{ id: 9, name: 'Course 9', description: 'Description 9', exercises: 90 },
		{ id: 10, name: 'Course 10', description: 'Description 10', exercises: 100 }
	];

	import TurtleCanvas from '$cp/TurtleCanvas.svelte';
	let turtleRef;
</script>

{#if courseId}
	<div class="flex gap-2 p-2">
		<div class="">
			<div class="gap-4">
				<button class="btn btn-primary" onclick={() => goto('?')}>Back</button>
			</div>
			<div class="mx-auto flex w-full flex-col justify-center gap-4">
				<h1 class="text-4xl font-bold">Course {courseId}</h1>
				<fieldset class="fieldset w-full">
					<legend class="fieldset-legend">Description</legend>
					<textarea class="textarea h-24 w-full" placeholder="Bio"></textarea>
				</fieldset>
			</div>
		</div>
		<div>
			<TurtleCanvas bind:this={turtleRef} width={500} height={500} />
		</div>
	</div>
{:else if exerciseId}
	<h1>Exercise {exerciseId}</h1>
{/if}

<div hidden={!!courseId || !!exerciseId}>
	<div class="tabs-box tabs w-fit">
		{#each possiblePages as item (item)}
			<button
				onclick={() => (currentPage.current = item)}
				class="tab"
				class:tab-active={currentPage.current.startsWith(item)}
				role="tab"
			>
				{item}
			</button>
		{/each}
	</div>
	{#if currentPage.current === possiblePages[0]}
		<div class="flex gap-2 p-2">
			<button
				class="btn btn-ghost btn-sm"
				class:btn-active={currentView.current === 'Cards'}
				onclick={() => (currentView.current = 'Cards')}
			>
				<Icon icon="ic:round-grid-view" class="text-2xl" />
			</button>
			<button
				class="btn btn-ghost btn-sm"
				class:btn-active={currentView.current === 'List'}
				onclick={() => (currentView.current = 'List')}
			>
				<Icon icon="ic:outline-table-chart" class="text-2xl" />
			</button>
		</div>

		<br />

		<div hidden={currentView.current !== 'Cards'} class="grid grid-cols-3 gap-4">
			{#each tempCourses as course (course.id)}
				<div class="card w-fit bg-base-100 shadow-lg">
					<figure>
						<img src="https://picsum.dev/300/200" alt="Shoes" />
					</figure>
					<div class="card-body">
						<h2 class="card-title">{course.name}</h2>
						<p class="card-text badge badge-primary">{course.description}</p>
						<p class="card-text badge badge-secondary">Exercises: {course.exercises}</p>
						<div class="card-actions justify-end">
							<button
								title="Edit"
								class="btn btn-primary"
								onclick={() => {
									goto(`?courseId=${course.id}`, {
										replaceState: false,
										keepFocus: true,
										noScroll: true
									});
								}}
							>
								Edit
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if currentPage.current === possiblePages[1]}
		<h1>Exercises</h1>
	{/if}
</div>
