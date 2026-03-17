<script lang="ts">
	import { getCourseAnalytics, exportCourseAttempts } from '$remote/courses.remote';
	import { getLocalized } from '$lib/i18n/index.svelte';
	import { MoveLeft, Download, BarChart3 } from '@lucide/svelte';
	import Boundary from '$cp/Boundary.svelte';

	type Props = {
		courseId: string;
		courseTitle: string;
		onBack: () => void;
	};

	let { courseId, courseTitle, onBack }: Props = $props();

	let analytics = $derived(getCourseAnalytics({ courseId }));
	let exporting = $state(false);

	async function handleExportCsv() {
		exporting = true;
		try {
			const data = await exportCourseAttempts({ courseId });
			if (!data?.rows?.length) {
				alert('No attempts to export.');
				return;
			}

			const headers = [
				'attemptId',
				'exerciseId',
				'exerciseTitle',
				'exerciseType',
				'userId',
				'actorType',
				'score',
				'passed',
				'startedAt',
				'endedAt',
				'locale',
				'createdAt'
			];

			const csvRows = [
				headers.join(','),
				...data.rows.map((row: Record<string, unknown>) =>
					headers
						.map((h) => {
							const val = row[h];
							if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
								return `"${val.replace(/"/g, '""')}"`;
							}
							return String(val ?? '');
						})
						.join(',')
				)
			];

			const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${courseId}-attempts.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exporting = false;
		}
	}
</script>

<div class="p-4">
	<div class="mb-4 flex items-center gap-4">
		<button class="btn btn-ghost btn-sm" onclick={onBack}>
			<MoveLeft size="20" />
		</button>
		<div>
			<h2 class="text-xl font-bold">Course Analytics</h2>
			<p class="text-sm text-base-content/60">{courseTitle}</p>
		</div>
		<div class="flex-1"></div>
		<button class="btn btn-sm btn-primary" onclick={handleExportCsv} disabled={exporting}>
			<Download size="16" />
			{exporting ? 'Exporting...' : 'Export CSV'}
		</button>
	</div>

	<Boundary loading={analytics.loading}>
		{@const data = analytics.current as any}
		{#if data}
			<!-- Summary Cards -->
			<div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
				<div class="stat rounded-lg bg-base-200">
					<div class="stat-title">Exercises</div>
					<div class="stat-value text-2xl">{data.exerciseCount}</div>
				</div>
				<div class="stat rounded-lg bg-base-200">
					<div class="stat-title">Total Attempts</div>
					<div class="stat-value text-2xl">{data.totals.attempts}</div>
				</div>
				<div class="stat rounded-lg bg-base-200">
					<div class="stat-title">Unique Students</div>
					<div class="stat-value text-2xl">{data.totals.students}</div>
				</div>
				<div class="stat rounded-lg bg-base-200">
					<div class="stat-title">Avg Score</div>
					<div class="stat-value text-2xl">{data.totals.avgScore}%</div>
				</div>
			</div>

			<!-- Per-Exercise Table -->
			{#if data.exercises?.length}
				<div class="overflow-x-auto rounded-lg border border-base-300">
					<table class="table">
						<thead>
							<tr>
								<th>Exercise</th>
								<th>Type</th>
								<th>Attempts</th>
								<th>Students</th>
								<th>Pass Rate</th>
								<th>Avg Score</th>
							</tr>
						</thead>
						<tbody>
							{#each data.exercises as ex (ex.exerciseId)}
								<tr>
									<td class="font-medium">{getLocalized(ex.title)}</td>
									<td><span class="badge badge-sm badge-outline">{ex.type}</span></td>
									<td>{ex.attempts}</td>
									<td>{ex.students}</td>
									<td>
										<div class="flex items-center gap-2">
											<progress
												class="progress w-16"
												class:progress-success={ex.passRate >= 70}
												class:progress-warning={ex.passRate >= 40 && ex.passRate < 70}
												class:progress-error={ex.passRate < 40}
												value={ex.passRate}
												max="100"
											></progress>
											<span class="text-sm">{ex.passRate}%</span>
										</div>
									</td>
									<td>{ex.avgScore}%</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="rounded-lg border-2 border-dashed border-base-300 p-8 text-center">
					<BarChart3 class="mx-auto h-12 w-12 text-base-content/30" />
					<p class="mt-2 text-base-content/60">No attempt data yet.</p>
				</div>
			{/if}
		{/if}
	</Boundary>
</div>
