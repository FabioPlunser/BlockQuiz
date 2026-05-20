<script lang="ts">
	import {
		getUsers,
		createUser,
		updateUser,
		resetPassword,
		deleteUser
	} from '$remote/users.remote';
	import { setUserClasses, getAssignableClasses } from '$remote/classes.remote';
	import { Debounced, PersistedState } from 'runed';
	import { ROLES, Role } from '$lib/roles';
	import Loading from '$cp/Loading.svelte';
	import Modal from '$cp/Modal.svelte';
	import ClassesPanel from '$cp/cms/ClassesPanel.svelte';
	import SearchableDropdown from '$cp/SearchableDropdown.svelte';
	import type { User, UserWithClasses } from '$db/types';
	import { i18n } from '$lib/i18n/index.svelte';
	import { handleServerResult } from '$lib/utils/toast';
	import DataTable, { type Column } from '$lib/components/DataTable.svelte';
	import ColumnPicker from '$lib/components/ColumnPicker.svelte';
	import { Search, UserPlus, Trash2 } from '@lucide/svelte';
	import { showError, showSuccess } from '$lib/utils/toast';

	let activeTab = new PersistedState<'users' | 'classes'>('userView', 'users');

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
	let selectedUser = $state<UserWithClasses | undefined>(undefined);
	let locale = $derived(i18n.locale === 'de' ? 'de-DE' : 'en-US');

	// Column visibility
	let visibleColumns = new PersistedState<string[]>('usersVisibleColumns', [
		'email',
		'role',
		'classes',
		'status',
		'userId',
		'createdAt'
	]);

	// Reactive class options for the per-row dropdown. Use a stable handle
	// (not a $derived call) so each cell reads the same .current value.
	const classesQuery = getAssignableClasses();

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

	//-----------------------------------------------------------------------------
	// Table columns
	//-----------------------------------------------------------------------------
	let tableColumns = $derived<Column<UserWithClasses>[]>([
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
			key: 'classes',
			label: i18n.users_table_classes,
			class: 'w-2/6',
			cellSnippet: 'classes'
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
	async function update(user: UserWithClasses) {
		const result = await updateUser({ ...user }).updates(getUsers(filters));
		console.log('Update result', result);
		handleServerResult(result, i18n.toast_user_updated, i18n.toast_user_update_failed);
	}
	$inspect(users);

	async function handleSetUserClasses(target: UserWithClasses, nextClassIds: string[]) {
		// Strip IdP-owned classes and the user's existing SSO memberships from the
		// payload — the server enforces the same rule but this avoids confusing
		// "rejected" round-trips.
		const idpOwned = new Set(
			(classesQuery.current ?? []).filter((c) => c.ssoProviderId).map((c) => c.id)
		);
		const manualOnly = nextClassIds.filter(
			(id) => !target.ssoClassIds.includes(id) && !idpOwned.has(id)
		);
		const result = await setUserClasses({ userId: target.id, classIds: manualOnly }).updates(
			getUsers
		);
		if (result.success) {
			if (result.added > 0 || result.removed > 0) {
				showSuccess(i18n.users_classes_updated);
			}
		} else {
			showError(i18n.toast_generic_error);
		}
	}

	async function handleDelete(target: UserWithClasses) {
		const message = i18n.users_delete_confirm.replace('{email}', target.email);
		if (!confirm(message)) return;
		try {
			const result = await deleteUser({ id: target.id }).updates(getUsers);
			if (result.success) {
				showSuccess(i18n.users_delete_success);
			} else {
				showError(result.error ?? i18n.users_delete_failed);
			}
		} catch (err) {
			console.error('Delete failed', err);
			showError(i18n.users_delete_failed);
		}
	}
</script>

<svelte:head>
	<title>{i18n.users_title} | BlockQuiz</title>
</svelte:head>

<!-- Cell snippets for editable fields -->
{#snippet emailCell(user: UserWithClasses)}
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

{#snippet roleCell(user: UserWithClasses)}
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

{#snippet statusCell(user: UserWithClasses)}
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

{#snippet userIdCell(user: UserWithClasses)}
	<span class="font-mono text-xs text-base-content/70">{user.id}</span>
{/snippet}

{#snippet createdAtCell(user: UserWithClasses)}
	<span class="font-mono text-xs text-base-content/70">
		{new Date(user.createdAt).toLocaleDateString(locale)}
	</span>
{/snippet}

{#snippet userActions(user: UserWithClasses)}
	<button
		class="btn btn-sm btn-primary"
		onclick={() => {
			selectedUser = user;
			resetPasswordModal = true;
		}}
	>
		{i18n.users_reset_password}
	</button>
	<button
		class="btn btn-sm btn-error"
		title={i18n.users_delete_action}
		aria-label={i18n.users_delete_action}
		onclick={() => handleDelete(user)}
	>
		<Trash2 class="h-4 w-4" />
	</button>
{/snippet}

{#snippet classesCell(user: UserWithClasses)}
	{@const classList = classesQuery.current ?? []}
	{@const options = classList.map((c) => ({ value: c.id, label: c.name }))}
	{@const idpClassIds = classList.filter((c) => c.ssoProviderId).map((c) => c.id)}
	{@const ssoBadges = Object.fromEntries(
		idpClassIds.map((id) => [id, i18n.class_dropdown_idp_suffix])
	)}
	<SearchableDropdown
		{options}
		multiSelect
		values={user.classIds}
		disabledValues={idpClassIds}
		optionBadges={ssoBadges}
		placeholder={i18n.class_dropdown_placeholder}
		searchPlaceholder={i18n.classes_search_placeholder}
		emptyLabel={i18n.class_dropdown_empty}
		doneLabel={i18n.class_dropdown_done}
		multiSelectedTemplate={i18n.class_dropdown_n_selected}
		buttonClass="select-bordered select select-sm w-full text-left"
		onChangeMulti={(next) => handleSetUserClasses(user, next)}
	/>
{/snippet}

<div class="mx-auto flex w-full flex-col gap-6 p-4">
	<div class="tabs-box tabs self-start">
		<button
			class="tab"
			class:tab-active={activeTab.current === 'users'}
			onclick={() => (activeTab.current = 'users')}
		>
			{i18n.users_tab_users}
		</button>
		<button
			class="tab"
			class:tab-active={activeTab.current === 'classes'}
			onclick={() => (activeTab.current = 'classes')}
		>
			{i18n.users_tab_classes}
		</button>
	</div>

	{#if activeTab.current === 'classes'}
		<ClassesPanel />
	{:else}
		<!-- Filters Section -->
		<section class="card border border-base-300 bg-base-100 p-4 shadow-sm">
			<div class="mb-8 flex items-center justify-between gap-4">
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
						classes: classesCell,
						status: statusCell,
						userId: userIdCell,
						createdAt: createdAtCell
					}}
				/>
			</svelte:boundary>
		</section>
	{/if}
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
<Modal remoteFunction={createUser} bind:open={createUserModal} updates={[getUsers]}>
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
