<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';

	interface User {
		id: string;
		name: string;
		email: string;
		createdAt: Date;
		role?: 'student' | 'teacher' | 'author' | 'admin';
	}

	interface Props {
		users?: User[];
	}

	let { users = [] }: Props = $props();

	let searchTerm = $state('');

	const filteredUsers = $derived(
		users.filter(
			(user) =>
				user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				user.email.toLowerCase().includes(searchTerm.toLowerCase())
		)
	);

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat(i18n.locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(new Date(date));
	};

	const getRoleLabel = (role: string) => {
		const roleMap: Record<string, string> = {
			student: i18n.t('role_student'),
			teacher: i18n.t('role_teacher'),
			author: i18n.t('role_author'),
			admin: i18n.t('role_admin')
		};
		return roleMap[role] || role;
	};

	const getRoleBadgeClass = (role: string) => {
		const roleClasses: Record<string, string> = {
			student: 'badge-primary',
			teacher: 'badge-secondary',
			author: 'badge-accent',
			admin: 'badge-error'
		};
		return roleClasses[role] || 'badge-neutral';
	};

	const handleEdit = (userId: string) => {
		// TODO: Implement edit functionality
		console.log('Edit user:', userId);
	};

	const handleDelete = (userId: string) => {
		// TODO: Implement delete functionality
		console.log('Delete user:', userId);
	};
</script>

<div class="card bg-white shadow-lg">
	<div class="card-body">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h2 class="card-title text-2xl">{i18n.t('users_title')}</h2>
				<p class="text-sm text-slate-600">{i18n.t('users_description')}</p>
			</div>
			<button class="btn btn-primary">
				<i class="lni lni-user-add"></i>
				{i18n.t('users_add_new')}
			</button>
		</div>

		<div class="mb-4">
			<input
				type="text"
				bind:value={searchTerm}
				placeholder={i18n.t('users_search_placeholder')}
				class="input input-md w-full max-w-xs"
			/>
		</div>

		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					<tr>
						<th>{i18n.t('users_table_name')}</th>
						<th>{i18n.t('users_table_email')}</th>
						<th>{i18n.t('users_table_role')}</th>
						<th>{i18n.t('users_table_created')}</th>
						<th>{i18n.t('users_table_actions')}</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredUsers as user (user.id)}
						<tr>
							<td>
								<div class="flex items-center gap-3">
									<div class="placeholder avatar">
										<div class="w-10 rounded-full bg-neutral text-neutral-content">
											<span class="text-sm"
												>{user.name
													.split(' ')
													.map((n) => n[0])
													.join('')
													.toUpperCase()}</span
											>
										</div>
									</div>
									<div>
										<div class="font-semibold">{user.name}</div>
									</div>
								</div>
							</td>
							<td>{user.email}</td>
							<td>
								<span class="badge {getRoleBadgeClass(user.role || 'student')}"
									>{getRoleLabel(user.role || 'student')}</span
								>
							</td>
							<td class="text-sm text-slate-600">{formatDate(user.createdAt)}</td>
							<td>
								<div class="flex gap-2">
									<button class="btn btn-ghost btn-sm" onclick={() => handleEdit(user.id)}>
										{i18n.t('users_edit')}
									</button>
									<button
										class="btn text-error btn-ghost btn-sm"
										onclick={() => handleDelete(user.id)}
									>
										{i18n.t('users_delete')}
									</button>
								</div>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="text-center text-slate-500"> No users found </td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
