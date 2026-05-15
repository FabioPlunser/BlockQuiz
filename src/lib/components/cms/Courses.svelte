<script lang="ts">
	import type { CourseWithRelations as Course } from '$types/course';

	import Boundary from '$cp/Boundary.svelte';
	import ConfirmModal from '$cp/ConfirmModal.svelte';
	import CourseEditor from './CourseEditor.svelte';
	import CourseAnalytics from './CourseAnalytics.svelte';
	import { CMSToolbar, CMSCardView, CMSTableView } from '$lib/components/cms';
	import type { Column } from '$lib/components/DataTable.svelte';
	import { previewCourseTransfer, type CourseTransfer } from '$lib/import-export/transfers';

	import { PersistedState } from 'runed';
	import {
		archiveCourse,
		cloneCourse,
		deleteCourse,
		exportCourse,
		getCourses,
		importCourse,
		restoreCourse
	} from '$lib/remote/courses.remote';
	import { fly } from 'svelte/transition';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { sanitizeHtml } from '$lib/utils/sanitize';
	import { handleServerResult, showError } from '$lib/utils/toast';
	import {
		Archive,
		BarChart3,
		Copy,
		Download,
		Pencil,
		RotateCcw,
		Trash2,
		Upload
	} from '@lucide/svelte';

	// --------------------------------------------------------------------
	// State
	// --------------------------------------------------------------------
	let newCourse = $state(false);
	let editCourse = $state(false);
	let selectedCourse: Course | undefined = $state(undefined);
	let searchQuery = $state('');
	let archivedFilter = new PersistedState<'active' | 'archived' | 'all'>(
		'coursesArchivedFilter',
		'active'
	);
	let viewMode = new PersistedState<'cards' | 'table'>('coursesViewMode', 'cards');
	let importInput: HTMLInputElement | undefined = $state(undefined);
	type PendingConfirmation = {
		message: string;
		confirmLabel: string;
		confirmClass?: string;
		onConfirm: () => void;
	};
	let confirmOpen = $state(false);
	let pendingConfirmation: PendingConfirmation | null = $state(null);

	// Analytics state
	let viewingAnalytics: Course | undefined = $state(undefined);

	// Column visibility state
	let visibleColumns = new PersistedState<string[]>('coursesVisibleColumns', [
		'title',
		'description',
		'status',
		'exercises',
		'users'
	]);

	const courses = getCourses({});
	let courseList = $derived(await courses);

	function isArchived(course: Course) {
		return course.archivedAt != null;
	}

	function slugifyCourse(course: Course) {
		return (
			getLocalized(course.content?.title)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '') || course.id
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

	// --------------------------------------------------------------------
	// Filtered items
	// --------------------------------------------------------------------
	let filteredCourses = $derived.by(() => {
		let allCourses = (courseList ?? []) as Course[];

		if (archivedFilter.current === 'active') {
			allCourses = allCourses.filter((course) => !isArchived(course));
		} else if (archivedFilter.current === 'archived') {
			allCourses = allCourses.filter((course) => isArchived(course));
		}

		if (!searchQuery.trim()) return allCourses;

		const search = searchQuery.toLowerCase();
		return allCourses.filter((course) => {
			const title =
				(course.content?.title?.de?.toLowerCase() ?? '') +
				' ' +
				(course.content?.title?.en?.toLowerCase() ?? '');
			const desc =
				(course.content?.description?.de?.toLowerCase() ?? '') +
				' ' +
				(course.content?.description?.en?.toLowerCase() ?? '');
			return title.includes(search) || desc.includes(search);
		});
	});

	// --------------------------------------------------------------------
	// Table columns
	// --------------------------------------------------------------------
	let tableColumns = $derived<Column<Course>[]>([
		{
			key: 'title',
			label: i18n.courses_title_label,
			render: (c: Course) => c.content?.title,
			sortable: true
		},
		{
			key: 'description',
			label: i18n.courses_description_label,
			render: (c: Course) => {
				const desc = getLocalized(c.content?.description);
				return desc.length > 80 ? desc.slice(0, 80) + '...' : desc;
			},
			html: true
		},
		{
			key: 'status',
			label: i18n.cms_exercises_status,
			render: (c: Course) => {
				if (isArchived(c)) return `□ ${i18n.cms_archived}`;
				return c.published ? `✓ ${i18n.published}` : `○ ${i18n.draft}`;
			},
			sortable: true
		},
		{
			key: 'exercises',
			label: i18n.courses_exercises_label,
			render: (c: Course) => String(c.exerciseIds?.length ?? 0),
			sortable: true
		},
		{
			key: 'users',
			label: i18n.cms_courses_users_label,
			render: (c: Course) => String(c.userIds?.length ?? 0),
			sortable: true
		},
		{
			key: 'createdAt',
			label: i18n.users_created_at,
			render: (c: Course) => new Date(c.createdAt).toLocaleDateString(),
			sortable: true
		}
	]);

	// Filter columns by visibility
	let displayColumns = $derived.by(() => {
		return tableColumns.filter((c) => visibleColumns.current.includes(c.key));
	});

	// --------------------------------------------------------------------
	// Handlers
	// --------------------------------------------------------------------
	function handleCancel() {
		newCourse = false;
		editCourse = false;
		selectedCourse = undefined;
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

	function requestDelete(course: Course) {
		requestConfirmation(
			i18n.confirm_delete_course,
			() => void handleDelete(course),
			i18n.cms_delete
		);
	}

	function requestArchive(course: Course) {
		requestConfirmation(
			i18n.confirm_archive_course,
			() => void handleArchive(course),
			i18n.cms_archive
		);
	}

	function requestRestore(course: Course) {
		requestConfirmation(
			i18n.confirm_restore_course,
			() => void handleRestore(course),
			i18n.cms_restore
		);
	}

	async function handleDelete(course: Course) {
		try {
			let result = await deleteCourse(course.id).updates(courses);
			handleServerResult(result, i18n.toast_course_deleted, i18n.toast_course_delete_failed);
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: i18n.toast_generic_error },
				'',
				i18n.toast_course_delete_error
			);
		}
	}

	async function handleClone(course: Course) {
		const result = await cloneCourse({ id: course.id }).updates(courses);
		handleServerResult(result, i18n.toast_course_cloned, i18n.toast_course_clone_failed);
	}

	async function handleArchive(course: Course) {
		const result = await archiveCourse({ id: course.id }).updates(courses);
		handleServerResult(result, i18n.toast_course_archived, i18n.toast_course_archive_failed);
	}

	async function handleRestore(course: Course) {
		const result = await restoreCourse({ id: course.id }).updates(courses);
		handleServerResult(result, i18n.toast_course_restored, i18n.toast_course_restore_failed);
	}

	async function handleExport(course: Course) {
		try {
			const payload = await exportCourse({ id: course.id });
			downloadJson(`${slugifyCourse(course)}.course.json`, payload);
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: i18n.toast_course_export_failed },
				'',
				i18n.toast_course_export_failed
			);
		}
	}

	async function handleImport(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			const payload = JSON.parse(await file.text());
			const preview = previewCourseTransfer(payload);
			if (!preview.valid) {
				showError(preview.error);
				return;
			}

			requestConfirmation(
				`${i18n.import_preview_course}: ${preview.title}\n${i18n.import_preview_exercise_count}: ${preview.exerciseCount}\n${i18n.import_preview_draft_notice}`,
				() => void confirmImport(payload),
				i18n.cms_import,
				'btn-primary'
			);
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: i18n.toast_course_import_failed },
				'',
				i18n.toast_course_import_failed
			);
		} finally {
			input.value = '';
		}
	}

	async function confirmImport(payload: CourseTransfer) {
		try {
			const result = await importCourse({ payload }).updates(courses);
			handleServerResult(result, i18n.toast_course_imported, i18n.toast_course_import_failed);
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: i18n.toast_course_import_failed },
				'',
				i18n.toast_course_import_failed
			);
		}
	}

	function handleEdit(course: Course) {
		editCourse = true;
		selectedCourse = course;
	}

	function handleCreate() {
		newCourse = true;
	}

	function handleViewAnalytics(course: Course) {
		viewingAnalytics = course;
	}
</script>

{#snippet courseFilters()}
	<select class="select-bordered select select-sm" bind:value={archivedFilter.current}>
		<option value="active">{i18n.cms_filter_active}</option>
		<option value="archived">{i18n.cms_filter_archived}</option>
		<option value="all">{i18n.cms_filter_all}</option>
	</select>
{/snippet}

{#snippet courseToolbarActions()}
	<input
		bind:this={importInput}
		type="file"
		class="hidden"
		accept="application/json"
		onchange={handleImport}
	/>
	<button class="btn btn-outline btn-sm" onclick={() => importInput?.click()}>
		<Upload class="h-4 w-4" />
		{i18n.cms_import}
	</button>
{/snippet}

{#snippet courseCard(course: Course)}
	<div class="card bg-base-300 shadow-xl transition-transform hover:scale-[1.02]">
		{#if course.content?.image}
			<figure>
				<img
					src={course.content.image}
					alt={i18n.courses_image_alt}
					class="max-h-48 w-full object-cover"
				/>
			</figure>
		{/if}
		<div class="card-body">
			<h2 class="card-title">{getLocalized(course.content?.title)}</h2>
			<p class="text-sm text-base-content/70">
				{@html sanitizeHtml(getLocalized(course.content?.description).slice(0, 100))}
			</p>
			<div class="mt-2 flex flex-wrap gap-1">
				{#if isArchived(course)}
					<span class="badge badge-sm badge-neutral">{i18n.cms_archived}</span>
				{:else if course.published}
					<span class="badge badge-sm badge-success">{i18n.published}</span>
				{:else}
					<span class="badge badge-sm badge-warning">{i18n.draft}</span>
				{/if}
				{#if course.exerciseIds?.length}
					<span class="badge badge-sm badge-secondary">
						{course.exerciseIds.length}
						{i18n.courses_exercises_label}
					</span>
				{/if}
				{#if course.userIds?.length}
					<span class="badge badge-sm badge-secondary">
						{course.userIds.length}
						{i18n.cms_courses_users_label}
					</span>
				{/if}
			</div>
			<div class="mt-4 card-actions flex-wrap justify-end">
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => handleViewAnalytics(course)}
					title={i18n.cms_view}
				>
					<BarChart3 class="h-4 w-4" />
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => handleClone(course)}
					title={i18n.cms_clone}
				>
					<Copy class="h-4 w-4" />
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => handleExport(course)}
					title={i18n.cms_export}
				>
					<Download class="h-4 w-4" />
				</button>
				{#if isArchived(course)}
					<button
						class="btn btn-ghost btn-sm"
						onclick={() => requestRestore(course)}
						title={i18n.cms_restore}
					>
						<RotateCcw class="h-4 w-4" />
					</button>
				{:else}
					<button
						class="btn btn-ghost btn-sm"
						onclick={() => requestArchive(course)}
						title={i18n.cms_archive}
					>
						<Archive class="h-4 w-4" />
					</button>
				{/if}
				<button class="btn btn-sm btn-error" onclick={() => requestDelete(course)}>
					{i18n.cms_delete}
				</button>
				<button class="btn btn-sm btn-primary" onclick={() => handleEdit(course)}>
					{i18n.cms_edit}
				</button>
			</div>
		</div>
	</div>
{/snippet}

{#snippet courseActions(course: Course)}
	<div class="flex gap-1">
		<button
			class="btn btn-ghost btn-xs"
			onclick={() => handleViewAnalytics(course)}
			title={i18n.cms_view}
			aria-label={i18n.cms_view}
		>
			<BarChart3 class="h-3 w-3" />
		</button>
		<button
			class="btn btn-ghost btn-xs"
			onclick={() => handleEdit(course)}
			title={i18n.cms_edit}
			aria-label={i18n.cms_edit}
		>
			<Pencil class="h-3 w-3" />
		</button>
		<button
			class="btn btn-ghost btn-xs"
			onclick={() => handleClone(course)}
			title={i18n.cms_clone}
			aria-label={i18n.cms_clone}
		>
			<Copy class="h-3 w-3" />
		</button>
		<button
			class="btn btn-ghost btn-xs"
			onclick={() => handleExport(course)}
			title={i18n.cms_export}
			aria-label={i18n.cms_export}
		>
			<Download class="h-3 w-3" />
		</button>
		{#if isArchived(course)}
			<button
				class="btn btn-ghost btn-xs"
				onclick={() => requestRestore(course)}
				title={i18n.cms_restore}
				aria-label={i18n.cms_restore}
			>
				<RotateCcw class="h-3 w-3" />
			</button>
		{:else}
			<button
				class="btn btn-ghost btn-xs"
				onclick={() => requestArchive(course)}
				title={i18n.cms_archive}
				aria-label={i18n.cms_archive}
			>
				<Archive class="h-3 w-3" />
			</button>
		{/if}
		<button
			class="btn text-error btn-ghost btn-xs"
			onclick={() => requestDelete(course)}
			title={i18n.cms_delete}
			aria-label={i18n.cms_delete}
		>
			<Trash2 class="h-3 w-3" />
		</button>
	</div>
{/snippet}

<div class="p-4">
	<Boundary>
		<!-- Analytics View -->
		{#if viewingAnalytics}
			<CourseAnalytics
				courseId={viewingAnalytics.id}
				courseTitle={getLocalized(viewingAnalytics.content?.title)}
				onBack={() => (viewingAnalytics = undefined)}
			/>
		{/if}

		<!-- Main Course List View -->
		{#if !newCourse && !editCourse && !viewingAnalytics}
			<CMSToolbar
				bind:viewMode={viewMode.current}
				bind:searchQuery
				searchPlaceholder={i18n.cms_courses_search_placeholder}
				createButtonLabel={i18n.cms_courses_add_button}
				onCreate={handleCreate}
				filters={courseFilters}
				actions={courseToolbarActions}
				showColumnPicker={true}
				columns={tableColumns}
				bind:visibleColumns={visibleColumns.current}
			/>

			{#if filteredCourses.length === 0}
				{@const totalCount = (courseList ?? []).length}
				{@const filtersHide = totalCount > 0}
				<div class="rounded-lg border-2 border-dashed border-base-300 p-12 text-center">
					<h3 class="text-lg font-medium">{i18n.cms_courses_empty_title}</h3>
					{#if filtersHide}
						<p class="mt-1 text-base-content/60">
							{totalCount} course{totalCount === 1 ? '' : 's'} exist but the current filter hides
							{totalCount === 1 ? 'it' : 'them all'}. Try resetting the filters.
						</p>
						<button
							class="btn mt-4 gap-2 btn-md btn-primary"
							onclick={() => {
								archivedFilter.current = 'active';
								searchQuery = '';
							}}
						>
							Reset filters
						</button>
					{:else}
						<p class="mt-1 text-base-content/60">{i18n.cms_courses_empty_hint}</p>
						<button class="btn mt-4 btn-primary" onclick={handleCreate}>
							{i18n.cms_courses_create_first}
						</button>
					{/if}
				</div>
			{:else if viewMode.current === 'cards'}
				<CMSCardView items={filteredCourses} card={courseCard} gridCols={3} />
			{:else}
				<CMSTableView items={filteredCourses} columns={displayColumns} actions={courseActions} />
			{/if}
		{/if}

		<!-- Course Editor (inline) -->
		{#if newCourse || editCourse}
			<div in:fly={{ y: -100, duration: 300 }}>
				<CourseEditor
					course={selectedCourse}
					remote={courses}
					isNew={newCourse}
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
