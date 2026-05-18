<script lang="ts">
	import type { CourseWithRelations as Course, CourseFormData } from '$types/course';
	import type { Exercise, ExerciseFormData } from '$types/exercise';
	import type { User } from '$types/user';

	import { MoveLeft } from '@lucide/svelte';
	import { Info, Users, BookText, GraduationCap } from '@lucide/svelte';
	import { fly } from 'svelte/transition';

	import LocalizedInput from '$cp/editor/LocalizedInput.svelte';
	import { LocalizedRichText } from '$cp/editor';
	import SelectableTable from '$cp/SelectableTable.svelte';
	import ColumnPicker from '$cp/ColumnPicker.svelte';
	import Boundary from '$cp/Boundary.svelte';
	import ExerciseEditor from './ExerciseEditor.svelte';
	import { PersistedState } from 'runed';

	import { getExercises } from '$lib/remote/exercises.remote';
	import { getAssignableStudents, getAssignableAuthors } from '$lib/remote/users.remote';
	import { getAssignableClasses } from '$lib/remote/classes.remote';
	import { createCourse, updateCourse, setCourseAuthor } from '$lib/remote/courses.remote';
	import SearchableDropdown from '$cp/SearchableDropdown.svelte';
	import { createDefaultCourseFormData } from '$types/course';
	import {
		validateCoursePublishReadiness,
		type CoursePublishValidationIssue
	} from '$lib/courses/validation';
	import { createLocalizedFuzzySearch } from '$lib/utils/fuzzySearch';
	import { handleServerResult, showError } from '$lib/utils/toast';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';

	// ---------------------------------------------------
	// Props
	// ---------------------------------------------------
	type Props = {
		course?: Course;
		remote?: any;
		onSave?: () => void;
		onCancel: () => void;
		isNew?: boolean;
	};

	let { course, remote, onSave, onCancel, isNew = true }: Props = $props();

	// ---------------------------------------------------
	// State
	// ---------------------------------------------------
	// Local editable form state intentionally diverges from the incoming prop while the user edits.
	// eslint-disable-next-line svelte/prefer-writable-derived
	let formData = $state<CourseFormData>(createDefaultCourseFormData());
	$inspect(formData);
	$effect(() => {
		formData = course
			? {
					content: course.content,
					published: course.published,
					exerciseIds: course.exerciseIds ?? [],
					userIds: course.userIds ?? [],
					classIds: course.classIds ?? []
				}
			: createDefaultCourseFormData();
	});

	let activeSection = $state('overview');
	let searchQueryExercises = $state('');
	let searchQueryUsers = $state('');
	let searchQueryClasses = $state('');
	// validationIssues is declared further down — after `selectedExercises` —
	// because Svelte 5 $derived blocks read state lazily but TypeScript still
	// enforces top-down declaration order.
	let publishedOnly = new PersistedState<boolean>('courseEditorPublishedOnly', false);
	let visibleExerciseColumnKeys = new PersistedState<string[]>('courseEditorExerciseColumns', [
		'title',
		'type',
		'description',
		'published',
		'edit'
	]);

	// Fetch exercises and assignable students/classes (live reactive query handles).
	const exercises = getExercises({});
	const users = getAssignableStudents();
	const classes = getAssignableClasses();
	const authors = getAssignableAuthors();
	let exerciseList = $derived((exercises.current ?? []) as Exercise[]);
	let userList = $derived((users.current ?? []) as User[]);
	type AssignableAuthor = { id: string; name: string | null; email: string; role: string };
	let authorList = $derived((authors.current ?? []) as AssignableAuthor[]);
	let authorOptions = $derived(
		authorList.map((a) => ({ value: a.id, label: a.email ?? a.name ?? a.id }))
	);
	// courses.createdBy stores the user's email (legacy text column, no FK), so
	// we resolve back to a user.id via email lookup for the dropdown selection.
	let currentAuthorId = $derived.by(() => {
		const email = course?.createdBy ?? '';
		return authorList.find((a) => a.email === email)?.id ?? '';
	});
	// Staged author selection — only persisted when the user clicks Save.
	let pendingAuthorId = $state<string>('');
	$effect(() => {
		// Re-sync whenever the loaded course or author list changes (e.g. on initial
		// load when the lookup resolves later than the editing prop arrives).
		pendingAuthorId = currentAuthorId;
	});
	type AssignableClass = {
		id: string;
		name: string;
		ssoProviderId: string | null;
		providerDomain: string | null;
		memberCount: number;
	};
	let classList = $derived((classes.current ?? []) as AssignableClass[]);
	let editSelectedExercise = $state<Exercise | undefined>(undefined);
	// ---------------------------------------------------
	// Filtered lists
	// ---------------------------------------------------
	let filteredExercises = $derived.by(() => {
		let allExercises = (exerciseList ?? []) as Exercise[];
		// Always show currently-selected exercises so unticking them is possible
		// even when filters would otherwise hide them.
		const selectedIds = new Set(formData.exerciseIds);
		if (publishedOnly.current) {
			allExercises = allExercises.filter((e) => e.published || selectedIds.has(e.id));
		}
		if (!searchQueryExercises.trim()) {
			return allExercises;
		}
		return createLocalizedFuzzySearch(allExercises, searchQueryExercises);
	});

	let filteredUsers = $derived.by(() => {
		const allUsers = (userList ?? []) as User[];
		if (!searchQueryUsers.trim()) {
			return allUsers;
		}
		return createLocalizedFuzzySearch(allUsers, searchQueryUsers);
	});

	let filteredClasses = $derived.by(() => {
		const all = classList;
		const q = searchQueryClasses.trim().toLowerCase();
		if (!q) return all;
		return all.filter((c) => c.name.toLowerCase().includes(q));
	});

	let selectedExercises = $derived.by(() => {
		const allExercises = (exerciseList ?? []) as Exercise[];
		const exercisesById = new Map(allExercises.map((exercise) => [exercise.id, exercise]));

		return formData.exerciseIds
			.map((id) => exercisesById.get(id))
			.filter((exercise): exercise is Exercise => Boolean(exercise));
	});

	// Reactive publish-validation. Re-runs whenever published, content,
	// exerciseIds, or the underlying exercise data changes — so the panel
	// always reflects the current state. Without this it was stale after
	// inline exercise edits.
	let validationIssues = $derived<CoursePublishValidationIssue[]>(
		formData.published
			? validateCoursePublishReadiness({
					content: formData.content,
					exerciseIds: formData.exerciseIds,
					exercises: selectedExercises
				}).issues
			: []
	);

	// ---------------------------------------------------
	// Table columns
	// ---------------------------------------------------
	let exerciseColumns = $derived([
		{
			key: 'title',
			label: i18n.courses_title_label,
			render: (e: Exercise) => e.content?.title ?? { de: '', en: '' }
		},
		{
			key: 'type',
			label: i18n.cms_exercises_type,
			render: (e: Exercise) => e.type
		},
		{
			key: 'description',
			label: i18n.courses_description_label,
			render: (e: Exercise) => e.content?.description ?? { de: '', en: '' },
			html: true
		},
		{
			key: 'published',
			label: i18n.cms_exercises_status,
			render: (e: Exercise) => (e.published ? i18n.cms_status_published : i18n.cms_status_draft)
		},
		{
			key: 'edit',
			label: i18n.cms_edit,
			cellSnippet: 'edit'
		}
	]);

	let displayedExerciseColumns = $derived(
		exerciseColumns.filter((c) => visibleExerciseColumnKeys.current.includes(c.key))
	);

	let userColumns = $derived([
		{
			key: 'email',
			label: i18n.users_table_email,
			render: (u: User) => u.email
		},
		{
			key: 'role',
			label: i18n.users_table_role,
			render: (u: User) => u.role
		}
	]);

	let classColumns = $derived([
		{
			key: 'name',
			label: i18n.classes_table_name,
			render: (c: AssignableClass) => c.name
		},
		{
			key: 'source',
			label: i18n.classes_table_source,
			render: (c: AssignableClass) =>
				c.ssoProviderId
					? `${i18n.classes_source_sso_badge} · ${c.providerDomain ?? ''}`
					: i18n.classes_source_manual_badge
		},
		{
			key: 'members',
			label: i18n.classes_table_members,
			render: (c: AssignableClass) => String(c.memberCount)
		}
	]);

	// ---------------------------------------------------
	// Sections
	// ---------------------------------------------------
	let sections = $derived([
		{ id: 'overview', label: i18n.cms_course_section_overview, icon: Info },
		{ id: 'exercises', label: i18n.cms_course_section_exercises, icon: BookText },
		{ id: 'users', label: i18n.cms_course_section_users, icon: Users },
		{ id: 'classes', label: i18n.cms_course_section_classes, icon: GraduationCap }
	]);

	// ---------------------------------------------------
	// Selection handlers
	// ---------------------------------------------------
	function handleSelectExercise(exercise: Exercise) {
		const index = formData.exerciseIds.indexOf(exercise.id);
		if (index >= 0) {
			formData.exerciseIds = formData.exerciseIds.filter((id) => id !== exercise.id);
		} else {
			formData.exerciseIds = [...formData.exerciseIds, exercise.id];
		}
	}

	function handleSelectAllExercises() {
		const allIds = filteredExercises.map((e) => e.id);
		if (allIds.every((id) => formData.exerciseIds.includes(id))) {
			formData.exerciseIds = [];
		} else {
			formData.exerciseIds = allIds;
		}
	}

	function moveExercise(exerciseId: string, direction: -1 | 1) {
		const index = formData.exerciseIds.indexOf(exerciseId);
		const nextIndex = index + direction;

		if (index < 0 || nextIndex < 0 || nextIndex >= formData.exerciseIds.length) {
			return;
		}

		const nextExerciseIds = [...formData.exerciseIds];
		[nextExerciseIds[index], nextExerciseIds[nextIndex]] = [
			nextExerciseIds[nextIndex],
			nextExerciseIds[index]
		];
		formData.exerciseIds = nextExerciseIds;
	}

	function removeExercise(exerciseId: string) {
		formData.exerciseIds = formData.exerciseIds.filter((id) => id !== exerciseId);
	}

	function handleSelectUser(user: User) {
		const index = formData.userIds.indexOf(user.id);
		if (index >= 0) {
			formData.userIds = formData.userIds.filter((id) => id !== user.id);
		} else {
			formData.userIds = [...formData.userIds, user.id];
		}
	}

	function handleSelectAllUsers() {
		const allIds = filteredUsers.map((u) => u.id);
		if (allIds.every((id) => formData.userIds.includes(id))) {
			formData.userIds = [];
		} else {
			formData.userIds = allIds;
		}
	}

	// Staging only — the actual server call happens in handleSave.
	function handleSelectAuthor(newAuthorId: string) {
		pendingAuthorId = newAuthorId;
	}

	function handleSelectClass(c: AssignableClass) {
		const index = formData.classIds.indexOf(c.id);
		if (index >= 0) {
			formData.classIds = formData.classIds.filter((id) => id !== c.id);
		} else {
			formData.classIds = [...formData.classIds, c.id];
		}
	}

	function handleSelectAllClasses() {
		const allIds = filteredClasses.map((c) => c.id);
		if (allIds.every((id) => formData.classIds.includes(id))) {
			formData.classIds = [];
		} else {
			formData.classIds = allIds;
		}
	}

	// ---------------------------------------------------
	// Image handling
	// ---------------------------------------------------
	let imagePreview = $derived(formData.content.image ?? '');

	async function handleImage(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];

		if (!file) return;

		// Validate file type
		if (!file.type.startsWith('image/')) {
			showError(i18n.cms_image_invalid_type);
			return;
		}

		// Validate file size (max 5MB)
		const maxSize = 5 * 1024 * 1024;
		if (file.size > maxSize) {
			showError(i18n.cms_image_invalid_size);
			return;
		}

		// Convert to base64
		return new Promise<void>((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = (event) => {
				const base64String = event.target?.result as string;
				formData.content.image = base64String;
				resolve();
			};

			reader.onerror = () => {
				reject(new Error(i18n.cms_image_read_failed));
			};

			reader.readAsDataURL(file);
		});
	}

	// ---------------------------------------------------
	// Save handler
	// ---------------------------------------------------
	async function handleSave() {
		// validationIssues is now a $derived value — no manual reset needed.
		if (formData.published && validationIssues.length > 0) {
			showError(i18n.toast_course_validation_failed);
			return;
		}

		try {
			if (isNew) {
				const result = await createCourse({
					content: formData.content,
					published: formData.published,
					exerciseIds: formData.exerciseIds,
					userIds: formData.userIds,
					classIds: formData.classIds
				});

				handleServerResult(result, i18n.toast_course_created, i18n.toast_course_create_failed);
				if (result.success) {
					await remote?.refresh?.();
					onSave?.();
				}
			} else {
				const result = await updateCourse({
					id: course!.id,
					content: formData.content,
					published: formData.published,
					exerciseIds: formData.exerciseIds,
					userIds: formData.userIds,
					classIds: formData.classIds
				});

				handleServerResult(result, i18n.toast_course_updated, i18n.toast_course_update_failed);
				if (result.success) {
					// Persist the staged author change as part of the same Save flow.
					if (pendingAuthorId && pendingAuthorId !== currentAuthorId) {
						const authorResult = await setCourseAuthor({
							courseId: course!.id,
							userId: pendingAuthorId
						});
						if (!authorResult.success) {
							showError(authorResult.error ?? i18n.toast_generic_error);
						}
					}
					await remote?.refresh?.();
					// Stay on the detail page — the user clicks back to leave.
				}
			}
		} catch (error) {
			console.error(error);
			handleServerResult(
				{ success: false, error: i18n.toast_course_save_error },
				'',
				i18n.toast_course_save_error
			);
		}
	}
	function handleExerciseCancel() {
		editSelectedExercise = undefined;
	}

	function exerciseToFormData(exercise: Exercise): ExerciseFormData & { id: string } {
		return {
			id: exercise.id,
			type: exercise.type,
			content: exercise.content,
			config: exercise.config,
			published: exercise.published,
			order: exercise.order
		};
	}
</script>

{#snippet editExercise(exercise: Exercise)}
	<button class="btn btn-sm btn-primary" onclick={() => (editSelectedExercise = exercise)}
		>{i18n.cms_edit}</button
	>
{/snippet}

<Boundary>
	{#if !editSelectedExercise}
		<div class="p-4">
			<div class="card bg-base-200 p-4 shadow-xl">
				<!-- Header -->
				<div class="flex items-center gap-4">
					<button class="btn btn-ghost btn-sm" onclick={() => onCancel()}>
						<MoveLeft size="32" />
					</button>
					<h1 class="text-2xl font-bold">
						{isNew ? i18n.cms_course_create_title : i18n.cms_course_edit_title}
					</h1>
					<div class="absolute right-4 flex flex-wrap gap-4">
						<label class="label cursor-pointer gap-2">
							<input
								type="checkbox"
								class="toggle toggle-primary"
								bind:checked={formData.published}
							/>
							<span class="label-text">{i18n.published}</span>
						</label>
						<button class="btn btn-primary" onclick={handleSave}>{i18n.save}</button>
					</div>
				</div>

				<!-- Tab Navigation -->
				<div class="mt-2 mb-2 tabs">
					{#each sections as section (section.id)}
						<button
							class="tab"
							class:tab-active={activeSection === section.id}
							onclick={() => (activeSection = section.id)}
						>
							<section.icon size="24" />
							<span class="ml-2">{section.label}</span>
						</button>
					{/each}
				</div>

				{#if validationIssues.length > 0}
					<div class="my-4 alert text-sm alert-error">
						<div>
							<div class="font-semibold">{i18n.cms_course_validation_title}</div>
							<ul class="mt-1 list-disc pl-5">
								{#each validationIssues as issue, index (`${issue.code}-${issue.field}-${index}`)}
									<li>{issue.message}</li>
								{/each}
							</ul>
						</div>
					</div>
				{/if}

				<!-- Overview Section -->
				{#if activeSection === 'overview'}
					<fieldset class="fieldset">
						<legend class="fieldset-legend">{i18n.cms_image_upload}</legend>
						<input type="file" class="file-input" accept="image/*" onchange={handleImage} />
					</fieldset>
					{#if imagePreview}
						<button
							class="btn w-fit btn-sm btn-primary"
							onclick={() => (formData.content.image = '')}
						>
							{i18n.cms_image_remove}
						</button>
						<img
							src={imagePreview}
							alt={i18n.cms_course_preview_alt}
							class="mt-2 max-h-64 object-contain"
						/>
					{/if}
					<div class="mt-4">
						<LocalizedInput bind:value={formData.content.title} label={i18n.cms_field_title} />
					</div>
					<div class="mt-4">
						<LocalizedRichText
							bind:value={formData.content.description}
							label={i18n.cms_field_description}
						/>
					</div>
					{#if !isNew && course?.id}
						<div class="mt-6">
							<label class="label-text mb-1 block text-sm font-semibold">
								{i18n.cms_course_author_label}
							</label>
							<SearchableDropdown
								options={authorOptions}
								value={pendingAuthorId}
								placeholder={course?.createdBy ?? i18n.cms_course_author_placeholder}
								searchPlaceholder={i18n.cms_course_author_search}
								emptyLabel={i18n.cms_course_author_empty}
								buttonClass="select-bordered select select-sm w-full text-left"
								onChange={handleSelectAuthor}
							/>
							<p class="mt-1 text-xs text-base-content/60">
								{i18n.cms_course_author_hint}
							</p>
						</div>
					{/if}
				{/if}

				<!-- Exercises Section -->
				{#if activeSection === 'exercises'}
					<div class="mt-4">
						<h2 class="mb-2 font-bold">{i18n.cms_course_assign_exercises}</h2>
						<p class="mb-4 text-sm text-base-content/60">
							{i18n.cms_course_assign_exercises_hint}
							{formData.exerciseIds.length}
						</p>

						<div class="mb-4 rounded-box border border-base-300 bg-base-100 p-4">
							<div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
								<div>
									<h3 class="font-semibold">{i18n.cms_course_order_title}</h3>
									<p class="text-sm text-base-content/60">{i18n.cms_course_order_hint}</p>
								</div>
								<div class="badge badge-outline">{selectedExercises.length}</div>
							</div>

							{#if selectedExercises.length === 0}
								<p class="mt-3 text-sm text-base-content/60">{i18n.cms_course_order_empty}</p>
							{:else}
								<ol class="mt-3 flex flex-col gap-2">
									{#each selectedExercises as selectedExercise, index (selectedExercise.id)}
										<li
											class="flex flex-col gap-2 rounded-xl bg-base-200 p-3 sm:flex-row sm:items-center"
										>
											<div class="flex min-w-0 flex-1 items-center gap-3">
												<span class="badge badge-primary">{index + 1}</span>
												<div class="min-w-0">
													<div class="truncate font-medium">
														{getLocalized(selectedExercise.content.title)}
													</div>
													<div class="text-xs text-base-content/60">{selectedExercise.type}</div>
												</div>
											</div>
											<div class="flex flex-wrap gap-2">
												<button
													class="btn btn-outline btn-xs"
													type="button"
													onclick={() => moveExercise(selectedExercise.id, -1)}
													disabled={index === 0}
													aria-label={`${i18n.cms_course_move_up}: ${getLocalized(selectedExercise.content.title)}`}
												>
													{i18n.cms_course_move_up}
												</button>
												<button
													class="btn btn-outline btn-xs"
													type="button"
													onclick={() => moveExercise(selectedExercise.id, 1)}
													disabled={index === selectedExercises.length - 1}
													aria-label={`${i18n.cms_course_move_down}: ${getLocalized(selectedExercise.content.title)}`}
												>
													{i18n.cms_course_move_down}
												</button>
												<button
													class="btn btn-outline btn-xs btn-error"
													type="button"
													onclick={() => removeExercise(selectedExercise.id)}
													aria-label={`${i18n.cms_course_remove_exercise}: ${getLocalized(selectedExercise.content.title)}`}
												>
													{i18n.cms_course_remove_exercise}
												</button>
											</div>
										</li>
									{/each}
								</ol>
							{/if}
						</div>

						<div class="mb-3 flex flex-wrap items-center gap-2">
							<label
								class="label flex cursor-pointer items-center gap-2 rounded-lg border border-base-300 px-3 py-2"
							>
								<input
									type="checkbox"
									class="checkbox checkbox-sm checkbox-primary"
									bind:checked={publishedOnly.current}
								/>
								<span class="label-text text-sm">
									{i18n.cms_course_show_published_only ?? 'Published only'}
								</span>
							</label>
							<ColumnPicker
								columns={exerciseColumns}
								bind:visibleColumns={visibleExerciseColumnKeys.current}
							/>
						</div>

						<SelectableTable
							items={filteredExercises}
							columns={displayedExerciseColumns}
							bind:searchQuery={searchQueryExercises}
							bind:selectedIds={formData.exerciseIds}
							onSelect={handleSelectExercise}
							onSelectAll={handleSelectAllExercises}
							tableClass="h-96"
							cellSnippets={{
								edit: editExercise
							}}
						/>
					</div>
				{/if}

				<!-- Users Section -->
				{#if activeSection === 'users'}
					{#if formData.classIds.length > 0}
						<h2 class="mb-2 font-bold">{i18n.cms_course_assign_users_error}</h2>
					{:else}
						<div class="mt-4">
							<h2 class="mb-2 font-bold">{i18n.cms_course_assign_users}</h2>
							<p class="mb-4 text-sm text-base-content/60">
								{i18n.cms_course_assign_users_hint}
								{formData.userIds.length}
							</p>
							<SelectableTable
								items={filteredUsers}
								columns={userColumns}
								bind:searchQuery={searchQueryUsers}
								bind:selectedIds={formData.userIds}
								onSelect={handleSelectUser}
								onSelectAll={handleSelectAllUsers}
								tableClass="h-96"
							/>
						</div>
					{/if}
				{/if}

				<!-- Classes Section -->
				{#if activeSection === 'classes'}
					<div class="mt-4">
						<h2 class="mb-2 font-bold">{i18n.cms_course_assign_classes}</h2>
						<p class="mb-4 text-sm text-base-content/60">
							{i18n.cms_course_assign_classes_hint}
							{formData.classIds.length}
						</p>
						<SelectableTable
							items={filteredClasses}
							columns={classColumns}
							bind:searchQuery={searchQueryClasses}
							bind:selectedIds={formData.classIds}
							onSelect={handleSelectClass}
							onSelectAll={handleSelectAllClasses}
							tableClass="h-96"
						/>
					</div>
				{/if}
			</div>
		</div>
	{/if}
	{#if editSelectedExercise}
		<div in:fly={{ y: -100, duration: 300 }} class="top-0 z-10">
			<ExerciseEditor
				exercise={exerciseToFormData(editSelectedExercise)}
				remote={exercises}
				isNew={false}
				onCancel={handleExerciseCancel}
				onSave={handleExerciseCancel}
			/>
		</div>
	{/if}
</Boundary>
