<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';

	interface Exercise {
		id: string;
		type: 'io' | 'turtle';
		status: 'draft' | 'published';
		createdAt: number;
		createdBy?: string | null;
		metaJson: string;
	}

	interface Props {
		exercises?: Exercise[];
	}

	let { exercises = [] }: Props = $props();

	let activeTab = $state<'exercises' | 'quizzes'>('exercises');

	const formatDate = (timestamp: number) => {
		return new Intl.DateTimeFormat(i18n.locale, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		}).format(new Date(timestamp));
	};

	const getTypeLabel = (type: string) => {
		const typeMap: Record<string, string> = {
			io: i18n.t('cms_type_io'),
			turtle: i18n.t('cms_type_turtle')
		};
		return typeMap[type] || type;
	};

	const getStatusLabel = (status: string) => {
		const statusMap: Record<string, string> = {
			draft: i18n.t('cms_status_draft'),
			published: i18n.t('cms_status_published')
		};
		return statusMap[status] || status;
	};

	const getStatusBadgeClass = (status: string) => {
		return status === 'published' ? 'badge-success' : 'badge-warning';
	};

	const handleEdit = (exerciseId: string) => {
		// TODO: Implement edit functionality
		console.log('Edit exercise:', exerciseId);
	};

	const handleDelete = (exerciseId: string) => {
		// TODO: Implement delete functionality
		console.log('Delete exercise:', exerciseId);
	};

	const handleView = (exerciseId: string) => {
		// TODO: Implement view functionality
		console.log('View exercise:', exerciseId);
	};
</script>

<div class="card bg-white shadow-lg">
	<div class="card-body">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h2 class="card-title text-2xl">{i18n.t('cms_title')}</h2>
				<p class="text-sm text-slate-600">{i18n.t('cms_description')}</p>
			</div>
		</div>

		<div role="tablist" class="tabs-box mb-6 tabs">
			<button
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'exercises'}
				onclick={() => (activeTab = 'exercises')}
			>
				{i18n.t('cms_exercises_tab')}
			</button>
			<button
				role="tab"
				class="tab"
				class:tab-active={activeTab === 'quizzes'}
				onclick={() => (activeTab = 'quizzes')}
			>
				{i18n.t('cms_quizzes_tab')}
			</button>
		</div>

		{#if activeTab === 'exercises'}
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold">{i18n.t('cms_exercises_title')}</h3>
				<button class="btn btn-sm btn-primary">
					<i class="lni lni-circle-plus"></i>
					{i18n.t('cms_add_exercise')}
				</button>
			</div>

			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>ID</th>
							<th>{i18n.t('cms_exercises_type')}</th>
							<th>{i18n.t('cms_exercises_status')}</th>
							<th>{i18n.t('cms_exercises_created')}</th>
							<th>{i18n.t('cms_exercises_actions')}</th>
						</tr>
					</thead>
					<tbody>
						{#each exercises as exercise (exercise.id)}
							<tr>
								<td class="font-mono text-xs">{exercise.id.slice(0, 8)}...</td>
								<td>
									<span class="badge badge-outline">{getTypeLabel(exercise.type)}</span>
								</td>
								<td>
									<span class="badge {getStatusBadgeClass(exercise.status)}"
										>{getStatusLabel(exercise.status)}</span
									>
								</td>
								<td class="text-sm text-slate-600">{formatDate(exercise.createdAt)}</td>
								<td>
									<div class="flex gap-2">
										<button class="btn btn-ghost btn-sm" onclick={() => handleView(exercise.id)}>
											{i18n.t('cms_view')}
										</button>
										<button class="btn btn-ghost btn-sm" onclick={() => handleEdit(exercise.id)}>
											{i18n.t('cms_edit')}
										</button>
										<button
											class="btn text-error btn-ghost btn-sm"
											onclick={() => handleDelete(exercise.id)}
										>
											{i18n.t('cms_delete')}
										</button>
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="text-center text-slate-500"> No exercises found </td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold">{i18n.t('cms_quizzes_tab')}</h3>
				<button class="btn btn-sm btn-primary">
					<i class="lni lni-circle-plus"></i>
					{i18n.t('cms_add_quiz')}
				</button>
			</div>

			<div class="py-8 text-center text-slate-500">Quiz management coming soon...</div>
		{/if}
	</div>
</div>
