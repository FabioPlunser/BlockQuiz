<script lang="ts">
	import { getUsers, createUser, updateUser, resetPassword } from '$remote/users.remote';
	import { Debounced, PersistedState } from 'runed';
	import { ROLES, Role } from '$lib/roles';
	import Loading from '$cp/Loading.svelte';
	import Modal from '$cp/Modal.svelte';
	import type { User } from '$db/types';
	import { i18n } from '$lib/i18n/index.svelte';
	import { handleServerResult } from '$lib/utils/toast';
	import DataTable, { type Column } from '$lib/components/DataTable.svelte';
	import ColumnPicker from '$lib/components/ColumnPicker.svelte';
	import { Search, UserPlus } from '@lucide/svelte';

	//-----------------------------------------------------------------------------
	// Types
	//-----------------------------------------------------------------------------
	type Filters = {
		search: string;
		role: Role | undefined;
		active: boolean | undefined;
	};

	type StatusFilter = 'all' | 'active' | 'inactive';

	const DEFAULT_FILTERS: Filters = {
		search: '',
		role: undefined,
		active: undefined
	};

	function getRoleLabel(role: string) {
		if (role === Role.ADMIN) return i18n.role_admin;
		if (role === Role.AUTHOR) return i18n.role_author;
		if (role === Role.TEACHER) return i18n.role_teacher;
		return i18n.role_student;
	}

	//-----------------------------------------------------------------------------
	// State
	//-----------------------------------------------------------------------------
	let filters = $state<Filters>({ ...DEFAULT_FILTERS });
	let statusFilter = $state<StatusFilter>('all');
	let resetPasswordModal = $state(false);
	let createUserModal = $state(false);
	let search = $state('');
	let selectedUser = $state<User | undefined>(undefined);
	let locale = $derived(i18n.locale === 'de' ? 'de-DE' : 'en-US');

	// Column visibility
	let visibleColumns = new PersistedState<string[]>('usersVisibleColumns', [
		'email',
		'role',
		'status',
		'userId',
		'createdAt'
	]);

	//-----------------------------------------------------------------------------
	// Debounced search
	//-----------------------------------------------------------------------------
	const debouncedSearch = new Debounced(() => search, 200);
	$effect(() => {
		filters.search = debouncedSearch.current;
	});

	//-----------------------------------------------------------------------------
	// Data fetching
	//-----------------------------------------------------------------------------
	let users = $derived(getUsers(filters));

	//-----------------------------------------------------------------------------
	// Handlers
	//-----------------------------------------------------------------------------
	function handleStatusChange(value: StatusFilter) {
		statusFilter = value;
		filters.active = value === 'all' ? undefined : value === 'active';
	}

	// async function updateFieldKey(
	// 	event: KeyboardEvent & { currentTarget: HTMLInputElement },
	// 	id: string,
	// 	field: string
	// ) {
	// 	if (!event || event?.key !== 'Enter') {
	// 		return;
	// 	}
	// 	updateField(id, field, event.currentTarget.value as string);
	// }

	// async function updateField(
	// 	user: User,
	// 	field: string,
	// 	value: HTMLInputElement['value'] | HTMLInputElement['checked']
	// ) {
	// 	try {
	// 		const result = await updateUser({ ...user, [field]: value }).updates(users);
	// 		handleServerResult(result, 'User updated successfully', 'Failed to update user');
	// 	} catch (err) {
	// 		console.error('Update failed', err);
	// 		handleServerResult({ success: false, error: 'Update failed' }, '', 'Failed to update user');
	// 	}
	// }

	//-----------------------------------------------------------------------------
	// Table columns
	//-----------------------------------------------------------------------------
	let tableColumns = $derived<Column<User>[]>([
		{
			key: 'email',
			label: i18n.users_table_email,
			sortable: true,
			class: 'w-2/6',
			cellSnippet: 'email'
		},
		{
			key: 'role',
			label: i18n.users_table_role,
			sortable: true,
			class: 'w-1/6',
			cellSnippet: 'role'
		},
		{
			key: 'status',
			label: i18n.users_status_label,
			sortable: true,
			class: 'w-1/6',
			cellSnippet: 'status'
		},
		{
			key: 'userId',
			label: i18n.users_user_id,
			class: 'w-2/6',
			cellSnippet: 'userId'
		},
		{
			key: 'createdAt',
			label: i18n.users_created_at,
			sortable: true,
			class: 'w-2/6',
			cellSnippet: 'createdAt'
		}
	]);
	async function update(user: User) {
		const result = await updateUser({ ...user }).updates(users);
		handleServerResult(result, i18n.toast_user_updated, i18n.toast_user_update_failed);
	}
</script>

<svelte:head>
	<title>{i18n.users_title} | BlockQuiz</title>
</svelte:head>

<!-- Cell snippets for editable fields -->
{#snippet emailCell(user: User)}
	<input
		type="text"
		class="input input-sm w-full font-medium"
		bind:value={user.email}
		onkeydown={(event) => {
			if (event.key === 'Enter') {
				update(user);
			}
		}}
		onblur={() => {
			update(user);
		}}
	/>
{/snippet}

{#snippet roleCell(user: User)}
	<select
		class="select w-full select-sm"
		bind:value={user.role}
		onchange={() => {
			update(user);
		}}
	>
		{#each ROLES as role (role)}
			<option value={role}>{getRoleLabel(role)}</option>
		{/each}
	</select>
{/snippet}

{#snippet statusCell(user: User)}
	<label class="flex items-center gap-3">
		<input
			type="checkbox"
			class="toggle toggle-primary"
			bind:checked={user.active}
			onchange={() => {
				update(user);
			}}
		/>
		<span
			class={`badge border-0 ${user.active ? 'badge-success' : 'badge-ghost text-base-content/70'}`}
		>
			{user.active ? i18n.users_status_active : i18n.users_status_inactive}
		</span>
	</label>
{/snippet}

{#snippet userIdCell(user: User)}
	<span class="font-mono text-xs text-base-content/70">{user.id}</span>
{/snippet}

{#snippet createdAtCell(user: User)}
	<span class="font-mono text-xs text-base-content/70">
		{new Date(user.createdAt).toLocaleDateString(locale)}
	</span>
{/snippet}

{#snippet userActions(user: User)}
	<button
		class="btn btn-sm btn-primary"
		onclick={() => {
			selectedUser = user;
			resetPasswordModal = true;
		}}
	>
		{i18n.users_reset_password}
	</button>
{/snippet}

<div class="mx-auto flex w-full flex-col gap-6 p-4">
	<!-- Filters Section -->
	<section class="rounded-box bg-base-200/60 p-4 shadow-md">
		<div class="flex items-center justify-between gap-4">
			<div class="flex items-center gap-4">
				<!-- Search -->
				<div class="form-control grow sm:max-w-xs">
					<label class="input-bordered input flex items-center gap-2">
						<input
							id="search"
							type="text"
							class="grow"
							placeholder={i18n.users_name_or_email}
							bind:value={search}
						/>
						<Search class="h-4 w-4 opacity-60" />
					</label>
				</div>

				<!-- Role Filter -->
				<div class="form-control sm:max-w-xs">
					<select id="role" class="select-bordered select" bind:value={filters.role}>
						<option value={undefined}>{i18n.users_all_roles}</option>
						{#each ROLES as role (role)}
							<option value={role}>{getRoleLabel(role)}</option>
						{/each}
					</select>
				</div>

				<!-- Status Filter -->
				<div class="form-control sm:max-w-xs">
					<select
						id="status"
						class="select-bordered select"
						value={statusFilter}
						onchange={(event) => handleStatusChange(event.currentTarget.value as StatusFilter)}
					>
						<option value="all">{i18n.users_all_status}</option>
						<option value="active">{i18n.users_status_active}</option>
						<option value="inactive">{i18n.users_status_inactive}</option>
					</select>
				</div>

				<!-- Column Picker -->
				<ColumnPicker columns={tableColumns} bind:visibleColumns={visibleColumns.current} />
			</div>

			<!-- Add User -->
			<button class="btn btn-sm btn-primary" onclick={() => (createUserModal = true)}>
				<UserPlus class="h-4 w-4" />
				{i18n.users_add_button}
			</button>
		</div>
	</section>

	<!-- Users Table -->
	<svelte:boundary>
		{#snippet failed(error, reset)}
			<div class="alert alert-error">
				<span class="text-red-500">{JSON.stringify(error)}</span>
				<button class="btn btn-sm" onclick={reset}>{i18n.try_again}</button>
			</div>
		{/snippet}
		{#snippet pending()}
			<Loading />
		{/snippet}

		{@const usersList = await getUsers(filters)}
		<section class="rounded-box border border-base-200 bg-base-200 shadow-md">
			<DataTable
				items={usersList}
				columns={tableColumns}
				bind:visibleColumns={visibleColumns.current}
				showSearch={false}
				showPagination={false}
				emptyMessage={i18n.users_empty}
				rowActions={userActions}
				cellSnippets={{
					email: emailCell,
					role: roleCell,
					status: statusCell,
					userId: userIdCell,
					createdAt: createdAtCell
				}}
			/>
		</section>
	</svelte:boundary>
</div>

<!-- Reset Password Modal -->
<Modal remoteFunction={resetPassword} bind:open={resetPasswordModal}>
	<label class="form-control">
		<span class="label-text text-sm font-semibold">{i18n.users_new_password}</span>
		<input {...resetPassword.fields.email.as('text')} value={selectedUser?.email ?? ''} hidden />
		<input
			{...resetPassword.fields.password.as('password')}
			class="input-bordered input"
			placeholder={i18n.users_password_hint}
		/>
	</label>
	{#each resetPassword.fields.allIssues() as issuer (issuer.path)}
		<div>
			<span class="text-red-500">{issuer.path}: {issuer.message}</span>
		</div>
	{/each}
	{#snippet controls()}
		<button class="btn btn-primary" type="submit" onclick={(e) => e.stopPropagation()}>
			{i18n.users_reset_password}
		</button>
	{/snippet}
</Modal>

<!-- Create User Modal -->
<Modal remoteFunction={createUser} bind:open={createUserModal}>
	<div class="grid items-center gap-4 md:grid-cols-2">
		<label class="form-control">
			<span class="label-text text-sm font-semibold">{i18n.form_email_label}</span>
			<input
				{...createUser.fields.email.as('text')}
				class="input-bordered input"
				placeholder={i18n.form_email_placeholder}
			/>
		</label>
		<label class="form-control">
			<span class="label-text text-sm font-semibold">{i18n.users_status_active}</span>
			<input {...createUser.fields.active.as('checkbox')} class="checkbox" />
		</label>
	</div>
	<div class="grid gap-4 md:grid-cols-2">
		<label class="form-control">
			<span class="label-text text-sm font-semibold">{i18n.users_temp_password}</span>
			<input
				{...createUser.fields.password.as('password')}
				class="input-bordered input"
				placeholder={i18n.users_password_hint}
			/>
		</label>
		<label class="form-control">
			<span class="label-text text-sm font-semibold">{i18n.users_table_role}</span>
			<select {...createUser.fields.role.as('select')} class="select-bordered select">
				{#each ROLES as role (role)}
					<option value={role}>{getRoleLabel(role)}</option>
				{/each}
			</select>
		</label>
	</div>
	<div class="flex flex-col gap-4">
		{#each createUser.fields.allIssues() as issue (issue.path)}
			<div>
				<span class="text-red-500">{issue.path}: {issue.message}</span>
			</div>
		{/each}
	</div>
	{#snippet controls()}
		<button class="btn btn-primary" type="submit">{i18n.users_create_submit}</button>
	{/snippet}
</Modal>
