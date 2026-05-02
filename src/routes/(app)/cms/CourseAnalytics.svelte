<script lang="ts">
	import {
		getCourseAnalytics,
		exportCourseAttempts,
		exportCourseResearch
	} from '$remote/courses.remote';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { MoveLeft, Download, BarChart3 } from '@lucide/svelte';
	import Boundary from '$cp/Boundary.svelte';
	import { showInfo } from '$lib/utils/toast';

	type Props = {
		courseId: string;
		courseTitle: string;
		onBack: () => void;
	};

	let { courseId, courseTitle, onBack }: Props = $props();

	let analytics = $derived(getCourseAnalytics({ courseId }));
	let exporting = $state(false);

	function getLabel(key: string, fallback: string) {
		return (i18n as Record<string, string | undefined>)[key] ?? fallback;
	}

	function downloadFile(content: BlobPart, filename: string, type: string) {
		const blob = new Blob([content], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function getExerciseTypeLabel(type: string) {
		if (type === 'io') return i18n.cms_type_io;
		if (type === 'robot') return i18n.cms_type_robot;
		if (type === 'turtle') return i18n.cms_type_turtle;
		return type;
	}

	async function handleExportCsv() {
		exporting = true;
		try {
			const data = await exportCourseAttempts({ courseId });
			if (!data?.rows?.length) {
				showInfo(i18n.analytics_no_attempts);
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
				'durationMs',
				'hintUsageCount',
				'workspaceBlockCount',
				'generatedCodeLength',
				'locale',
				'createdAt'
			];

			const csvRows = [
				headers.join(','),
				...data.rows.map((row: Record<string, unknown>) =>
					headers
						.map((h) => {
							const val =
								h in row
									? row[h]
									: h === 'workspaceBlockCount' || h === 'generatedCodeLength'
										? (row.analytics as Record<string, unknown> | undefined)?.[h]
										: undefined;
							if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
								return `"${val.replace(/"/g, '""')}"`;
							}
							return String(val ?? '');
						})
						.join(',')
				)
			];

			downloadFile(csvRows.join('\n'), `${courseId}-attempts.csv`, 'text/csv;charset=utf-8;');
		} finally {
			exporting = false;
		}
	}

	async function handleExportJson() {
		exporting = true;
		try {
			const data = await exportCourseAttempts({ courseId });
			if (!data?.rows?.length) {
				showInfo(i18n.analytics_no_attempts);
				return;
			}

			downloadFile(JSON.stringify(data, null, 2), `${courseId}-attempts.json`, 'application/json');
		} finally {
			exporting = false;
		}
	}

	async function handleExportResearchJson() {
		exporting = true;
		try {
			const data = await exportCourseResearch({ courseId });
			if (!data?.rows?.length) {
				showInfo(i18n.analytics_no_attempts);
				return;
			}

			downloadFile(
				JSON.stringify(data, null, 2),
				`${courseId}-research-attempts.json`,
				'application/json'
			);
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
			<h2 class="text-xl font-bold">{i18n.analytics_title}</h2>
			<p class="text-sm text-base-content/60">{courseTitle}</p>
		</div>
		<div class="flex-1"></div>
		<button class="btn btn-sm btn-primary" onclick={handleExportCsv} disabled={exporting}>
			<Download size="16" />
			{exporting
				? getLabel('analytics_exporting', 'Exporting...')
				: getLabel('analytics_export_csv', 'Export CSV')}
		</button>
		<button class="btn btn-outline btn-sm" onclick={handleExportJson} disabled={exporting}>
			<Download size="16" />
			{exporting
				? getLabel('analytics_exporting', 'Exporting...')
				: getLabel('analytics_export_json', 'Export JSON')}
		</button>
		<button class="btn btn-outline btn-sm" onclick={handleExportResearchJson} disabled={exporting}>
			<Download size="16" />
			{exporting
				? getLabel('analytics_exporting', 'Exporting...')
				: (i18n.analytics_export_research_json ??
					getLabel('analytics_export_research_json', 'Research JSON'))}
		</button>
	</div>

	<Boundary loading={analytics.loading}>
		{@const data = analytics.current as any}
		{#if data}
			<!-- Summary Cards -->
			<div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
				<div class="stat rounded-lg bg-base-200">
					<div class="stat-title">{i18n.analytics_summary_exercises}</div>
					<div class="stat-value text-2xl">{data.exerciseCount}</div>
				</div>
				<div class="stat rounded-lg bg-base-200">
					<div class="stat-title">{i18n.analytics_summary_attempts}</div>
					<div class="stat-value text-2xl">{data.totals.attempts}</div>
				</div>
				<div class="stat rounded-lg bg-base-200">
					<div class="stat-title">{i18n.analytics_summary_students}</div>
					<div class="stat-value text-2xl">{data.totals.students}</div>
				</div>
				<div class="stat rounded-lg bg-base-200">
					<div class="stat-title">{i18n.analytics_summary_avg_score}</div>
					<div class="stat-value text-2xl">{data.totals.avgScore}%</div>
				</div>
				<div class="stat rounded-lg bg-base-200">
					<div class="stat-title">
						{getLabel('analytics_summary_avg_blocks', 'Avg. blocks')}
					</div>
					<div class="stat-value text-2xl">{data.totals.avgWorkspaceBlockCount ?? 0}</div>
				</div>
				<div class="stat rounded-lg bg-base-200">
					<div class="stat-title">
						{getLabel('analytics_summary_avg_code_length', 'Avg. code length')}
					</div>
					<div class="stat-value text-2xl">{data.totals.avgGeneratedCodeLength ?? 0}</div>
				</div>
			</div>

			<!-- Per-Exercise Table -->
			{#if data.exercises?.length}
				<div class="overflow-x-auto rounded-lg border border-base-300">
					<table class="table">
						<thead>
							<tr>
								<th>{i18n.analytics_table_exercise}</th>
								<th>{i18n.analytics_table_type}</th>
								<th>{i18n.analytics_table_attempts}</th>
								<th>{i18n.analytics_table_students}</th>
								<th>{i18n.analytics_table_pass_rate}</th>
								<th>{i18n.analytics_table_avg_score}</th>
								<th>{getLabel('analytics_table_avg_blocks', 'Avg. blocks')}</th>
								<th>{getLabel('analytics_table_avg_code_length', 'Avg. code')}</th>
							</tr>
						</thead>
						<tbody>
							{#each data.exercises as ex (ex.exerciseId)}
								<tr>
									<td class="font-medium">{getLocalized(ex.title)}</td>
									<td>
										<span class="badge badge-outline badge-sm">{getExerciseTypeLabel(ex.type)}</span
										>
									</td>
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
									<td>{ex.avgWorkspaceBlockCount ?? 0}</td>
									<td>{ex.avgGeneratedCodeLength ?? 0}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="rounded-lg border-2 border-dashed border-base-300 p-8 text-center">
					<BarChart3 class="mx-auto h-12 w-12 text-base-content/30" />
					<p class="mt-2 text-base-content/60">{i18n.analytics_empty}</p>
				</div>
			{/if}
		{/if}
	</Boundary>
</div>
