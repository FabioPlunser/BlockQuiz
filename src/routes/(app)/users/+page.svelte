<script lang="ts">
	import { getUsers, createUser, updateUser, resetPassword } from '$remote/users.remote';
	import { ROLES, Role } from '$lib/roles';
	import Loading from '$cp/Loading.svelte';
	import Modal from '$cp/Modal.svelte';
	//-----------------------------------------------------------------------------
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
	//-----------------------------------------------------------------------------
	//-----------------------------------------------------------------------------
	let filters = $state<Filters>({ ...DEFAULT_FILTERS });
	let statusFilter = $state<StatusFilter>('all');
	let resetPasswordModal = $state(false);
	let createUserModal = $state(false);
	//-----------------------------------------------------------------------------
	//-----------------------------------------------------------------------------
	function handleStatusChange(value: StatusFilter) {
		statusFilter = value;
		filters.active = value === 'all' ? undefined : value === 'active';
	}

	function resetFilters() {
		filters = { ...DEFAULT_FILTERS };
		handleStatusChange('all');
	}

	async function updateFieldKey(
		event: KeyboardEvent & { currentTarget: HTMLInputElement },
		id: string,
		field: string
	) {
		if (!event || event?.key !== 'Enter') {
			return;
		}
		updateField(id, field, event.currentTarget.value as string);
	}
	async function updateField(
		id: string,
		field: string,
		value: HTMLInputElement['value'] | HTMLInputElement['checked']
	) {
		try {
			await updateUser({ id, [field]: value }).updates(getUsers(filters));
		} catch (err) {
			console.error('Update failed', err);
		}
	}

	// async function handleCreateUser() {
	// 	createError = '';
	// 	try {
	// 		const result = await createUser(newUser);
	// 		if (!result?.success) {
	// 			createError = result?.message || 'Failed to create user';
	// 			return;
	// 		}
	// 		closeModal();
	// 		loadUsers();
	// 	} catch (err) {
	// 		console.error(err);
	// 		createError = 'Something went wrong. Please try again.';
	// 	}
	// }
</script>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
	<section class="rounded-box bg-base-200/60 p-4 shadow-md">
		<div class="flex flex-wrap gap-4">
			<div class="form-control grow sm:max-w-xs">
				<label class="label" for="search">
					<span class="label-text text-sm font-semibold">Search</span>
				</label>
				<label class="input flex items-center gap-2">
					<input
						id="search"
						type="text"
						class="grow"
						placeholder="Name or email"
						bind:value={filters.search}
					/>
					<i class="lni lni-search-2"></i>
				</label>
			</div>

			<div class="form-control sm:max-w-xs">
				<label class="label" for="role">
					<span class="label-text text-sm font-semibold">Role</span>
				</label>
				<select id="role" class="select-bordered select" bind:value={filters.role}>
					<option value={undefined}>All roles</option>
					{#each ROLES as role (role)}
						<option value={role}>{role}</option>
					{/each}
				</select>
			</div>

			<div class="form-control sm:max-w-xs">
				<label class="label" for="status">
					<span class="label-text text-sm font-semibold">Status</span>
				</label>
				<select
					id="status"
					class="select-bordered select"
					value={statusFilter}
					onchange={(event) => handleStatusChange(event.currentTarget.value as StatusFilter)}
				>
					<option value="all">All</option>
					<option value="active">Active</option>
					<option value="inactive">Inactive</option>
				</select>
			</div>

			<button class="btn self-end text-sm font-semibold btn-ghost" onclick={resetFilters}>
				Reset
			</button>
			<button
				class="btn self-end text-sm font-semibold btn-primary"
				onclick={() => (createUserModal = true)}>Add user</button
			>
		</div>
	</section>

	<svelte:boundary>
		{#snippet failed(error, reset)}
			<span class="text-red-500">{JSON.stringify(error)}</span>
			<button onclick={reset}>Failed! try again</button>
		{/snippet}
		{#snippet pending()}
			<Loading />
		{/snippet}

		<section class="rounded-box border border-base-200 bg-base-200 shadow-md">
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th class="w-2/6">Email</th>
							<th class="w-1/6">Role</th>
							<th class="w-1/6">Status</th>
							<th class="hidden w-2/6 lg:table-cell">User ID</th>
							<th class="hidden w-2/6 lg:table-cell">Createt At</th>
						</tr>
					</thead>
					<tbody>
						{#each await getUsers(filters) as user (user.id)}
							<tr class="align-middle">
								<td>
									<div class="flex flex-col gap-1">
										<input
											type="text"
											class="input input-sm font-medium"
											value={user.email}
											onkeydown={(event) => updateFieldKey(event, user.id, 'email')}
											onblur={(event) => updateField(user.id, 'email', event.currentTarget.value)}
										/>
									</div>
								</td>
								<td>
									<select
										class="select select-sm"
										value={user.role}
										onchange={(event) => updateField(user.id, 'role', event.currentTarget.value)}
									>
										{#each ROLES as role (role)}
											<option value={role}>{role}</option>
										{/each}
									</select>
								</td>
								<td>
									<label class="flex items-center gap-3">
										<input
											id="activeUserToggle"
											type="checkbox"
											class="toggle toggle-primary"
											checked={user.active}
											onchange={(event) =>
												updateField(user.id, 'active', event.currentTarget.checked)}
										/>
										<span
											class={`badge border-0 ${user.active ? 'badge-success' : 'badge-ghost text-base-content/70'}`}
										>
											{user.active ? 'Active' : 'Inactive'}
										</span>
									</label>
								</td>
								<td class="hidden font-mono text-xs text-base-content/70 lg:table-cell"
									>{user.id}</td
								>
								<td class="hidden font-mono text-xs text-base-content/70 lg:table-cell"
									>{new Date(user.createdAt).toLocaleDateString()}</td
								>
								<td class="">
									<button class="btn btn-sm btn-primary" onclick={() => (resetPasswordModal = true)}
										>Reset PWD</button
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</svelte:boundary>
</div>

<Modal remoteFunction={resetPassword} bind:open={resetPasswordModal}>
	<label class="form-control">
		<span class="label-text text-sm font-semibold">New Password</span>
		<input
			{...resetPassword.fields.password.as('password')}
			class="input-bordered input"
			placeholder="At least 8 characters"
		/>
	</label>
	{#each resetPassword.fields.allIssues() as issuer (issuer.path)}
		<div>
			<span class="text-red-500">{issuer.path}: {issuer.message}</span>
		</div>
	{/each}
	{#snippet controls()}
		<button class="btn btn-primary" type="submit"> Create user </button>
	{/snippet}
</Modal>

<Modal remoteFunction={createUser} bind:open={createUserModal}>
	<div class="grid gap-4 md:grid-cols-2">
		<label class="form-control">
			<span class="label-text text-sm font-semibold">Email</span>
			<input
				{...createUser.fields.email.as('text')}
				class="input-bordered input"
				placeholder="email"
			/>
		</label>
	</div>
	<div class="grid gap-4 md:grid-cols-2">
		<label class="form-control">
			<span class="label-text text-sm font-semibold">Temp password</span>
			<input
				{...createUser.fields.password.as('password')}
				class="input-bordered input"
				placeholder="At least 8 characters"
			/>
		</label>
		<label class="form-control">
			<span class="label-text text-sm font-semibold">Role</span>
			<select {...createUser.fields.role.as('select')} class="select-bordered select">
				{#each ROLES as role (role)}
					<option value={role}>{role}</option>
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
		<button class="btn btn-primary" type="submit"> Create user </button>
	{/snippet}
</Modal>
