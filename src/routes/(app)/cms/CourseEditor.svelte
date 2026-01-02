<script lang="ts">
	import type { Course, CourseFormData } from '$types/course';
	import type { Exercise } from '$types/exercise';
	import type { User } from '$types/user';

	import { MoveLeft } from '@lucide/svelte';
	import { Info, Users, BookText } from '@lucide/svelte';

	import LocalizedInput from '$cp/editor/LocalizedInput.svelte';
	import { LocalizedRichText } from '$cp/editor';
	import SelectableTable from '$cp/SelectableTable.svelte';
	import Boundary from '$cp/Boundary.svelte';

	import { getExercises } from '$lib/remote/exercises.remote';
	import { getUsers } from '$lib/remote/users.remote';
	import { createCourse, updateCourse } from '$lib/remote/courses.remote';
	import { createDefaultCourseFormData } from '$types/course';
	import { createLocalizedFuzzySearch } from '$lib/utils/fuzzySearch';

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
	let formData = $state<CourseFormData>(
		course
			? {
					content: course.content,
					published: course.published,
					exerciseIds: course.exerciseIds ?? [],
					userIds: course.userIds ?? []
				}
			: createDefaultCourseFormData()
	);

	let activeSection = $state('overview');
	let searchQueryExercises = $state('');
	let searchQueryUsers = $state('');

	// Fetch exercises and users
	let exercises = $derived(getExercises({}));
	let users = $derived(getUsers({}));

	// ---------------------------------------------------
	// Filtered lists
	// ---------------------------------------------------
	let filteredExercises = $derived.by(() => {
		const allExercises = (exercises.current as Exercise[]) ?? [];
		if (!searchQueryExercises.trim()) {
			return allExercises;
		}
		return createLocalizedFuzzySearch(allExercises, searchQueryExercises);
	});

	let filteredUsers = $derived.by(() => {
		const allUsers = (users.current as User[]) ?? [];
		if (!searchQueryUsers.trim()) {
			return allUsers;
		}
		return createLocalizedFuzzySearch(allUsers, searchQueryUsers);
	});

	// ---------------------------------------------------
	// Table columns
	// ---------------------------------------------------
	const exerciseColumns = [
		{
			key: 'title',
			label: 'Title',
			render: (e: Exercise) => e.content?.title ?? { de: '', en: '' }
		},
		{
			key: 'type',
			label: 'Type',
			render: (e: Exercise) => e.type
		},
		{
			key: 'description',
			label: 'Description',
			render: (e: Exercise) => e.content?.description ?? { de: '', en: '' },
			html: true
		}
	];

	const userColumns = [
		{
			key: 'email',
			label: 'Email',
			render: (u: User) => u.email
		},
		{
			key: 'role',
			label: 'Role',
			render: (u: User) => u.role
		}
	];

	// ---------------------------------------------------
	// Sections
	// ---------------------------------------------------
	const sections = [
		{ id: 'overview', label: 'Overview', icon: Info },
		{ id: 'exercises', label: 'Exercises', icon: BookText },
		{ id: 'users', label: 'Users', icon: Users }
	];

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
			alert('Please select an image file');
			return;
		}

		// Validate file size (max 5MB)
		const maxSize = 5 * 1024 * 1024;
		if (file.size > maxSize) {
			alert('Image size must be less than 5MB');
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
				reject(new Error('Failed to read file'));
			};

			reader.readAsDataURL(file);
		});
	}

	// ---------------------------------------------------
	// Save handler
	// ---------------------------------------------------
	async function handleSave() {
		try {
			if (isNew) {
				const result = await createCourse({
					content: formData.content,
					published: formData.published,
					exerciseIds: formData.exerciseIds,
					userIds: formData.userIds
				}).updates(remote);

				if (result.success) {
					onSave?.();
				} else {
					alert('Failed to create course');
				}
			} else {
				const result = await updateCourse({
					id: course!.id,
					content: formData.content,
					published: formData.published,
					exerciseIds: formData.exerciseIds,
					userIds: formData.userIds
				}).updates(remote);

				if (result.success) {
					onSave?.();
				} else {
					alert('Failed to update course');
				}
			}
		} catch (error) {
			console.error(error);
			alert('An error occurred while saving the course');
		}
	}
</script>

<Boundary loading={exercises.loading || users.loading}>
	<div class="p-4">
		<div class="card bg-base-200 p-4 shadow-xl">
			<!-- Header -->
			<div class="flex items-center gap-4">
				<button class="btn btn-ghost btn-sm" onclick={() => onCancel()}>
					<MoveLeft size="32" />
				</button>
				<h1 class="text-2xl font-bold">{isNew ? 'Create Course' : 'Edit Course'}</h1>
				<div class="absolute right-4 flex flex-wrap gap-4">
					<label class="label cursor-pointer gap-2">
						<input
							type="checkbox"
							class="toggle toggle-primary"
							bind:checked={formData.published}
						/>
						<span class="label-text">Published</span>
					</label>
					<button class="btn btn-primary" onclick={handleSave}>Save</button>
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

			<!-- Overview Section -->
			{#if activeSection === 'overview'}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Upload an image</legend>
					<input type="file" class="file-input" accept="image/*" onchange={handleImage} />
				</fieldset>
				{#if imagePreview}
					<button
						class="btn w-fit btn-sm btn-primary"
						onclick={() => (formData.content.image = '')}
					>
						Remove Image
					</button>
					<img src={imagePreview} alt="Course Preview" class="mt-2 max-h-64 object-contain" />
				{/if}
				<div class="mt-4">
					<LocalizedInput bind:value={formData.content.title} label="Title" />
				</div>
				<div class="mt-4">
					<LocalizedRichText bind:value={formData.content.description} label="Description" />
				</div>
			{/if}

			<!-- Exercises Section -->
			{#if activeSection === 'exercises'}
				<div class="mt-4">
					<h2 class="mb-2 font-bold">Assign Exercises to Course</h2>
					<p class="mb-4 text-sm text-base-content/60">
						Select exercises that should be included in this course. Selected: {formData
							.exerciseIds.length}
					</p>
					<SelectableTable
						items={filteredExercises}
						columns={exerciseColumns}
						bind:searchQuery={searchQueryExercises}
						bind:selectedIds={formData.exerciseIds}
						onSelect={handleSelectExercise}
						onSelectAll={handleSelectAllExercises}
						tableClass="h-96"
					/>
				</div>
			{/if}

			<!-- Users Section -->
			{#if activeSection === 'users'}
				<div class="mt-4">
					<h2 class="mb-2 font-bold">Assign Users to Course</h2>
					<p class="mb-4 text-sm text-base-content/60">
						Select users that should have access to this course. Selected: {formData.userIds
							.length}
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
		</div>
	</div>
</Boundary>

