<script lang="ts">
	import type { Exercise } from '$lib/types/exercise';
	import type { DBExerciseType } from '$types/exercise';
	import ExerciseEditor from './ExerciseEditor.svelte';
	import Boundary from '$cp/Boundary.svelte';
	import ConfirmModal from '$cp/ConfirmModal.svelte';
	import { CMSToolbar, CMSCardView, CMSTableView } from '$lib/components/cms';
	import { previewExerciseTransfer, type ExerciseTransfer } from '$lib/import-export/transfers';

	import { exerciseTypes } from '$types/exercise';
	import {
		archiveExercise,
		cloneExercise,
		deleteExercise,
		exportExercise,
		getExercises,
		importExercise,
		restoreExercise
	} from '$remote/exercises.remote';
	import { getCourses } from '$remote/courses.remote';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import { PersistedState } from 'runed';
	import { fly } from 'svelte/transition';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { handleServerResult, showError } from '$lib/utils/toast';
	import { Archive, Copy, Download, RotateCcw, Upload } from '@lucide/svelte';

	// -------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------
	let newExercise = $state(false);
	let editExercise = $state(false);
	let filterType = $state<DBExerciseType>('all');
	let filterStatus = $state<'' | 'true' | 'false'>('');
	let filterArchived = new PersistedState<'active' | 'archived' | 'all'>(
		'exercisesArchivedFilter',
		'active'
	);
	let searchQuery = $state('');
	let selectedExercise: Exercise | undefined = $state(undefined);
	let viewMode = new PersistedState<'cards' | 'table'>('exercisesViewMode', 'cards');
	let importInput: HTMLInputElement | undefined = $state(undefined);
	let importCourseId = $state('');
	type PendingConfirmation = {
		message: string;
		confirmLabel: string;
		confirmClass?: string;
		onConfirm: () => void;
	};
	let confirmOpen = $state(false);
	let pendingConfirmation: PendingConfirmation | null = $state(null);

	let exercises = $derived(
		getExercises({
			type: filterType,
			archived:
				filterArchived.current === 'all'
					? undefined
					: filterArchived.current === 'archived'
						? true
						: false
		})
	);
	let courseOptions = $derived(getCourses({}));
	let activeCourses = $derived(
		(
			(courseOptions.current as Array<{
				id: string;
				archivedAt?: number | null;
				content: { title: { de: string; en: string } };
			}>) ?? []
		).filter((course) => course.archivedAt == null)
	);

	function isArchived(exercise: Exercise) {
		return exercise.archivedAt != null;
	}

	function slugifyExercise(exercise: Exercise) {
		return (
			getLocalized(exercise.content?.title)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '') || exercise.id
		);
	}

	function downloadJson(filename: string, payload: unknown) {
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}

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

	function getExerciseTypeLabel(type: DBExerciseType | Exercise['type']) {
		if (type === 'io') return i18n.cms_type_io;
		if (type === 'robot') return i18n.cms_type_robot;
		if (type === 'turtle') return i18n.cms_type_turtle;
		return String(type);
	}

	let tableColumns = $derived([
		{
			key: 'type',
			label: i18n.cms_exercises_type,
			render: (e: Exercise) => typeIcons[e.type] ?? e.type,
			class: 'w-16 text-center'
		},
		{
			key: 'title',
			label: i18n.courses_title_label,
			render: (e: Exercise) => e.content?.title
		},
		{
			key: 'description',
			label: i18n.courses_description_label,
			render: (e: Exercise) => {
				const desc = getLocalized(e.content?.description);
				return desc.length > 60 ? desc.slice(0, 60) + '...' : desc;
			},
			html: true
		},
		{
			key: 'status',
			label: i18n.cms_exercises_status,
			render: (e: Exercise) => {
				if (isArchived(e)) return `□ ${i18n.cms_archived}`;
				return e.published ? `✓ ${i18n.published}` : `○ ${i18n.draft}`;
			}
		},
		{
			key: 'order',
			label: i18n.cms_exercises_order,
			render: (e: Exercise) => String(e.order ?? 0),
			class: 'w-20'
		}
	]);

	// -------------------------------------------------------------------
	// Handlers
	// -------------------------------------------------------------------
	function handleCancel() {
		newExercise = false;
		editExercise = false;
		selectedExercise = undefined;
	}

	function requestConfirmation(
		message: string,
		onConfirm: () => void,
		confirmLabel = i18n.cms_delete,
		confirmClass?: string
	) {
		pendingConfirmation = { message, confirmLabel, confirmClass, onConfirm };
		confirmOpen = true;
	}

	function handleConfirmAction() {
		const action = pendingConfirmation?.onConfirm;
		pendingConfirmation = null;
		action?.();
	}

	function clearPendingConfirmation() {
		pendingConfirmation = null;
	}

	function requestDelete(exercise: Exercise) {
		requestConfirmation(
			i18n.confirm_delete_exercise,
			() => void handleDelete(exercise),
			i18n.cms_delete
		);
	}

	function requestArchive(exercise: Exercise) {
		requestConfirmation(
			i18n.confirm_archive_exercise,
			() => void handleArchive(exercise),
			i18n.cms_archive
		);
	}

	function requestRestore(exercise: Exercise) {
		requestConfirmation(
			i18n.confirm_restore_exercise,
			() => void handleRestore(exercise),
			i18n.cms_restore
		);
	}

	async function handleDelete(exercise: Exercise) {
		if (!exercise.id) return;

		try {
			const result = await deleteExercise(exercise.id).updates(exercises);
			handleServerResult(result, i18n.toast_exercise_deleted, i18n.toast_exercise_delete_failed);
		} catch (error) {
			console.error('Failed to delete exercise:', error);
			handleServerResult(
				{ success: false, error: i18n.toast_exercise_delete_failed },
				'',
				i18n.toast_exercise_delete_failed
			);
		}
	}

	async function handleClone(exercise: Exercise) {
		const result = await cloneExercise({ id: exercise.id }).updates(exercises);
		handleServerResult(result, i18n.toast_exercise_cloned, i18n.toast_exercise_clone_failed);
	}

	async function handleArchive(exercise: Exercise) {
		const result = await archiveExercise({ id: exercise.id }).updates(exercises);
		handleServerResult(result, i18n.toast_exercise_archived, i18n.toast_exercise_archive_failed);
	}

	async function handleRestore(exercise: Exercise) {
		const result = await restoreExercise({ id: exercise.id }).updates(exercises);
		handleServerResult(result, i18n.toast_exercise_restored, i18n.toast_exercise_restore_failed);
	}

	async function handleExport(exercise: Exercise) {
		try {
			const payload = await exportExercise({ id: exercise.id });
			downloadJson(`${slugifyExercise(exercise)}.exercise.json`, payload);
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: i18n.toast_exercise_export_failed },
				'',
				i18n.toast_exercise_export_failed
			);
		}
	}

	async function handleImport(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		const targetCourseId = importCourseId || activeCourses[0]?.id;
		const targetCourse = activeCourses.find((course) => course.id === targetCourseId);
		if (!file) return;

		if (!targetCourseId) {
			handleServerResult(
				{
					success: false,
					error: i18n.toast_exercise_import_missing_course
				},
				'',
				i18n.toast_exercise_import_missing_course
			);
			input.value = '';
			return;
		}

		try {
			const payload = JSON.parse(await file.text());
			const preview = previewExerciseTransfer(payload);
			if (!preview.valid) {
				showError(preview.error);
				return;
			}
			if (preview.kind !== 'exercise') {
				showError(i18n.toast_exercise_import_failed);
				return;
			}

			const targetCourseTitle = targetCourse
				? getLocalized(targetCourse.content.title)
				: targetCourseId;

			requestConfirmation(
				`${i18n.import_preview_exercise}: ${preview.title}\n${i18n.import_preview_type}: ${getExerciseTypeLabel(preview.exerciseType)}\n${i18n.import_preview_target_course}: ${targetCourseTitle}\n${i18n.import_preview_draft_notice}`,
				() => void confirmImport(targetCourseId, payload),
				i18n.cms_import,
				'btn-primary'
			);
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: i18n.toast_exercise_import_failed },
				'',
				i18n.toast_exercise_import_failed
			);
		} finally {
			input.value = '';
		}
	}

	async function confirmImport(courseId: string, payload: ExerciseTransfer) {
		try {
			const result = await importExercise({ courseId, payload }).updates(exercises);
			handleServerResult(result, i18n.toast_exercise_imported, i18n.toast_exercise_import_failed);
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: i18n.toast_exercise_import_failed },
				'',
				i18n.toast_exercise_import_failed
			);
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
		<select
			class="select-bordered select select-sm"
			bind:value={filterType}
			title={i18n.cms_exercises_type}
		>
			<option value="all">{i18n.cms_exercises_all_types}</option>
			{#each exerciseTypes as type (type)}
				<option value={type}>{getExerciseTypeLabel(type)}</option>
			{/each}
		</select>
		<select
			class="select-bordered select select-sm"
			bind:value={filterStatus}
			title={i18n.cms_exercises_status}
		>
			<option value="">{i18n.cms_exercises_all_status}</option>
			<option value="true">{i18n.published}</option>
			<option value="false">{i18n.draft}</option>
		</select>
		<select class="select-bordered select select-sm" bind:value={filterArchived.current}>
			<option value="active">{i18n.cms_filter_active}</option>
			<option value="archived">{i18n.cms_filter_archived}</option>
			<option value="all">{i18n.cms_filter_all}</option>
		</select>
	</div>
{/snippet}

{#snippet toolbarActions()}
	<input
		bind:this={importInput}
		type="file"
		class="hidden"
		accept="application/json"
		onchange={handleImport}
	/>
	<select class="select-bordered select select-sm" bind:value={importCourseId}>
		<option value="">{i18n.cms_exercise_import_target}</option>
		{#each activeCourses as course (course.id)}
			<option value={course.id}>{getLocalized(course.content.title)}</option>
		{/each}
	</select>
	<button class="btn btn-outline btn-sm" onclick={() => importInput?.click()}>
		<Upload class="h-4 w-4" />
		{i18n.cms_import}
	</button>
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
				<span class="text-2xl" title={getExerciseTypeLabel(exercise.type)}>
					{typeIcons[exercise.type] ?? exercise.type}
				</span>
				<h2 class="card-title text-base">{getLocalized(exercise.content?.title)}</h2>
			</div>
			<p class="text-sm text-base-content/70">
				{@html sanitizeHtml(getLocalized(exercise.content?.description).slice(0, 80))}
			</p>
			<div class="mt-2 card-actions items-center justify-between">
				<div class="flex items-center gap-1">
					{#if isArchived(exercise)}
						<span class="badge badge-sm badge-neutral">{i18n.cms_archived}</span>
					{:else if exercise.published}
						<span class="badge badge-sm badge-success">{i18n.published}</span>
					{:else}
						<span class="badge badge-sm badge-warning">{i18n.draft}</span>
					{/if}
				</div>
				<div class="flex flex-wrap gap-1">
					<button
						class="btn btn-ghost btn-sm"
						onclick={() => handleClone(exercise)}
						title={i18n.cms_clone}
					>
						<Copy class="h-4 w-4" />
					</button>
					<button
						class="btn btn-ghost btn-sm"
						onclick={() => handleExport(exercise)}
						title={i18n.cms_export}
					>
						<Download class="h-4 w-4" />
					</button>
					{#if isArchived(exercise)}
						<button
							class="btn btn-ghost btn-sm"
							onclick={() => requestRestore(exercise)}
							title={i18n.cms_restore}
						>
							<RotateCcw class="h-4 w-4" />
						</button>
					{:else}
						<button
							class="btn btn-ghost btn-sm"
							onclick={() => requestArchive(exercise)}
							title={i18n.cms_archive}
						>
							<Archive class="h-4 w-4" />
						</button>
					{/if}
					<button class="btn btn-sm btn-primary" onclick={() => handleEdit(exercise)}>
						{i18n.cms_edit}
					</button>
					<button class="btn btn-sm btn-error" onclick={() => requestDelete(exercise)}>
						{i18n.cms_delete}
					</button>
				</div>
			</div>
		</div>
	</div>
{/snippet}

{#snippet exerciseActions(exercise: Exercise)}
	<div class="flex gap-1">
		<button
			class="btn btn-ghost btn-xs"
			onclick={() => handleEdit(exercise)}
			title={i18n.cms_edit}
			aria-label={i18n.cms_edit}
		>
			<span aria-hidden="true">✏️</span>
		</button>
		<button
			class="btn btn-ghost btn-xs"
			onclick={() => handleClone(exercise)}
			title={i18n.cms_clone}
			aria-label={i18n.cms_clone}
		>
			<Copy class="h-3 w-3" />
		</button>
		<button
			class="btn btn-ghost btn-xs"
			onclick={() => handleExport(exercise)}
			title={i18n.cms_export}
			aria-label={i18n.cms_export}
		>
			<Download class="h-3 w-3" />
		</button>
		{#if isArchived(exercise)}
			<button
				class="btn btn-ghost btn-xs"
				onclick={() => requestRestore(exercise)}
				title={i18n.cms_restore}
				aria-label={i18n.cms_restore}
			>
				<RotateCcw class="h-3 w-3" />
			</button>
		{:else}
			<button
				class="btn btn-ghost btn-xs"
				onclick={() => requestArchive(exercise)}
				title={i18n.cms_archive}
				aria-label={i18n.cms_archive}
			>
				<Archive class="h-3 w-3" />
			</button>
		{/if}
		<button
			class="btn text-error btn-ghost btn-xs"
			onclick={() => requestDelete(exercise)}
			title={i18n.cms_delete}
			aria-label={i18n.cms_delete}
		>
			<span aria-hidden="true">🗑️</span>
		</button>
	</div>
{/snippet}

<div class="p-4">
	<Boundary loading={exercises.loading}>
		{#if !newExercise && !editExercise}
			<CMSToolbar
				bind:viewMode={viewMode.current}
				bind:searchQuery
				searchPlaceholder={i18n.cms_exercises_search_placeholder}
				createButtonLabel={i18n.cms_exercises_new_button}
				onCreate={handleCreate}
				filters={filterControls}
				actions={toolbarActions}
			/>

			{#if filteredExercises.length === 0}
				<div class="rounded-lg border-2 border-dashed border-base-300 p-12 text-center">
					<h3 class="text-lg font-medium">{i18n.cms_exercises_empty_title}</h3>
					<p class="mt-1 text-base-content/60">{i18n.cms_exercises_empty_hint}</p>
					<button class="btn mt-4 btn-primary" onclick={handleCreate}>
						{i18n.cms_exercises_create_first}
					</button>
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
	<ConfirmModal
		bind:open={confirmOpen}
		message={pendingConfirmation?.message ?? ''}
		confirmLabel={pendingConfirmation?.confirmLabel ?? i18n.cms_delete}
		confirmClass={pendingConfirmation?.confirmClass}
		onConfirm={handleConfirmAction}
		onCancel={clearPendingConfirmation}
	/>
</div>
