<script lang="ts">
	import type { Exercise } from '$lib/types/exercise';
	import type { DBExerciseType } from '$types/exercise';
	import ExerciseEditor from './ExerciseEditor.svelte';
	import Boundary from '$cp/Boundary.svelte';
	import { CMSToolbar, CMSCardView, CMSTableView } from '$lib/components/cms';

	import { exerciseTypes } from '$types/exercise';
	import { getExercises, deleteExercise } from '$remote/exercises.remote';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import { PersistedState } from 'runed';
	import { fly } from 'svelte/transition';
	import { getLocalized } from '$lib/i18n/index.svelte';

	// -------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------
	let newExercise = $state(false);
	let editExercise = $state(false);
	let filterType = $state<DBExerciseType>('all');
	let filterStatus = $state<'' | 'true' | 'false'>('');
	let searchQuery = $state('');
	let selectedExercise: Exercise | undefined = $state(undefined);
	let viewMode = new PersistedState<'cards' | 'table'>('exercisesViewMode', 'cards');

	let exercises = $derived(
		getExercises({
			type: filterType
		})
	);

	// -------------------------------------------------------------------
	// Filtered items
	// -------------------------------------------------------------------
	function searchInObject(obj: unknown, searchTerm: string): boolean {
		if (!searchTerm.trim()) return true;
		const lowerSearch = searchTerm.toLowerCase();

		if (typeof obj === 'string') {
			return obj.toLowerCase().includes(lowerSearch);
		}

		if (Array.isArray(obj)) {
			return obj.some((item) => searchInObject(item, searchTerm));
		}

		if (obj && typeof obj === 'object') {
			return Object.values(obj).some((value) => searchInObject(value, searchTerm));
		}

		return false;
	}

	let filteredExercises = $derived.by(() => {
		let items = (exercises.current as Exercise[]) ?? [];

		// Filter by status
		if (filterStatus === 'true') {
			items = items.filter((e) => e.published);
		} else if (filterStatus === 'false') {
			items = items.filter((e) => !e.published);
		}

		// Filter by search
		if (searchQuery.trim()) {
			items = items.filter((e) => searchInObject(e, searchQuery));
		}

		return items;
	});

	// -------------------------------------------------------------------
	// Table columns
	// -------------------------------------------------------------------
	const typeIcons: Record<string, string> = {
		turtle: '🐢',
		robot: '🤖',
		io: '📝'
	};

	const tableColumns = [
		{
			key: 'type',
			label: 'Type',
			render: (e: Exercise) => typeIcons[e.type] ?? e.type,
			class: 'w-16 text-center'
		},
		{
			key: 'title',
			label: 'Title',
			render: (e: Exercise) => e.content?.title
		},
		{
			key: 'description',
			label: 'Description',
			render: (e: Exercise) => {
				const desc = getLocalized(e.content?.description);
				return desc.length > 60 ? desc.slice(0, 60) + '...' : desc;
			},
			html: true
		},
		{
			key: 'status',
			label: 'Status',
			render: (e: Exercise) => (e.published ? '✓ Published' : '○ Draft')
		},
		{
			key: 'order',
			label: 'Order',
			render: (e: Exercise) => String(e.order ?? 0),
			class: 'w-20'
		}
	];

	// -------------------------------------------------------------------
	// Handlers
	// -------------------------------------------------------------------
	function handleCancel() {
		newExercise = false;
		editExercise = false;
		selectedExercise = undefined;
	}

	async function handleDelete(exercise: Exercise) {
		if (!exercise.id) return;
		if (!confirm('Are you sure you want to delete this exercise?')) return;

		try {
			await deleteExercise(exercise.id).updates(exercises);
		} catch (error) {
			console.error('Failed to delete exercise:', error);
			alert('Failed to delete exercise');
		}
	}

	function handleEdit(exercise: Exercise) {
		editExercise = true;
		selectedExercise = exercise;
	}

	function handleCreate() {
		newExercise = true;
	}
</script>

{#snippet filterControls()}
	<div class="flex items-center gap-2">
		<select class="select-bordered select select-sm" bind:value={filterType} title="Filter by type">
			<option value="all">All Types</option>
			{#each exerciseTypes as type (type)}
				<option value={type}>{type.toUpperCase()}</option>
			{/each}
		</select>
		<select
			class="select-bordered select select-sm"
			bind:value={filterStatus}
			title="Filter by status"
		>
			<option value="">All Status</option>
			<option value="true">Published</option>
			<option value="false">Draft</option>
		</select>
	</div>
{/snippet}

{#snippet exerciseCard(exercise: Exercise)}
	<div class="card-compact card bg-base-300 shadow-xl transition-transform hover:scale-[1.02]">
		{#if exercise.content?.image}
			<figure class="p-4">
				<img
					src={exercise.content.image}
					alt={getLocalized(exercise.content?.title)}
					class="max-h-32 object-contain"
				/>
			</figure>
		{/if}
		<div class="card-body">
			<div class="flex items-center gap-2">
				<span class="text-2xl" title={exercise.type}>
					{typeIcons[exercise.type] ?? exercise.type}
				</span>
				<h2 class="card-title text-base">{getLocalized(exercise.content?.title)}</h2>
			</div>
			<p class="text-sm text-base-content/70">
				{@html sanitizeHtml(getLocalized(exercise.content?.description).slice(0, 80))}
			</p>
			<div class="mt-2 card-actions items-center justify-between">
				<div class="flex items-center gap-1">
					{#if exercise.published}
						<span class="badge badge-sm badge-success">Published</span>
					{:else}
						<span class="badge badge-sm badge-warning">Draft</span>
					{/if}
				</div>
				<div class="flex gap-1">
					<button class="btn btn-sm btn-primary" onclick={() => handleEdit(exercise)}>
						Edit
					</button>
					<button class="btn btn-sm btn-error" onclick={() => handleDelete(exercise)}>
						Delete
					</button>
				</div>
			</div>
		</div>
	</div>
{/snippet}

{#snippet exerciseActions(exercise: Exercise)}
	<div class="flex gap-1">
		<button class="btn btn-ghost btn-xs" onclick={() => handleEdit(exercise)} title="Edit">
			✏️
		</button>
		<button
			class="btn text-error btn-ghost btn-xs"
			onclick={() => handleDelete(exercise)}
			title="Delete"
		>
			🗑️
		</button>
	</div>
{/snippet}

<div class="p-4">
	<Boundary loading={exercises.loading}>
		{#if !newExercise && !editExercise}
			<CMSToolbar
				bind:viewMode={viewMode.current}
				bind:searchQuery
				searchPlaceholder="Search exercises..."
				createButtonLabel="New Exercise"
				onCreate={handleCreate}
				filters={filterControls}
			/>

			{#if filteredExercises.length === 0}
				<div class="rounded-lg border-2 border-dashed border-base-300 p-12 text-center">
					<h3 class="text-lg font-medium">No exercises found</h3>
					<p class="mt-1 text-base-content/60">Get started by creating your first exercise.</p>
					<button class="btn mt-4 btn-primary" onclick={handleCreate}>Create Exercise</button>
				</div>
			{:else if viewMode.current === 'cards'}
				<CMSCardView items={filteredExercises} card={exerciseCard} gridCols={3} />
			{:else}
				<CMSTableView items={filteredExercises} columns={tableColumns} actions={exerciseActions} />
			{/if}
		{/if}

		{#if newExercise || editExercise}
			<div in:fly={{ y: -100, duration: 300 }}>
				<ExerciseEditor
					exercise={selectedExercise}
					remote={exercises}
					isNew={newExercise}
					onCancel={handleCancel}
					onSave={handleCancel}
				/>
			</div>
		{/if}
	</Boundary>
</div>
