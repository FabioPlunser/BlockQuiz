<script lang="ts">
	import { getCourseAnalytics, exportCourseAttempts } from '$remote/courses.remote';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { MoveLeft, Download, BarChart3 } from '@lucide/svelte';
	import Boundary from '$cp/Boundary.svelte';
	import { showError, showInfo } from '$lib/utils/toast';

	type Props = {
		courseId: string;
		courseTitle: string;
		onBack: () => void;
	};

	let { courseId, courseTitle, onBack }: Props = $props();

	let analytics = $derived(getCourseAnalytics({ courseId }));
	let analyticsData = $derived(analytics.current ?? null);
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
		a.style.display = 'none';
		// Some browsers (notably Firefox) ignore clicks on detached anchors and
		// cancel downloads if the object URL is revoked synchronously after click.
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			a.remove();
			URL.revokeObjectURL(url);
		}, 0);
	}

	function getExerciseTypeLabel(type: string) {
		if (type === 'io') return i18n.cms_type_io;
		if (type === 'robot') return i18n.cms_type_robot;
		if (type === 'turtle') return i18n.cms_type_turtle;
		return type;
	}

	function getExerciseTypeIcon(type: string) {
		if (type === 'io') return '🖥️';
		if (type === 'turtle') return '🐢';
		if (type === 'robot') return '🤖';
		return '❓';
	}

	function formatDuration(ms: number): string {
		if (!ms || ms <= 0) return '–';
		const totalSeconds = Math.round(ms / 1000);
		if (totalSeconds < 60) return `${totalSeconds}s`;
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
	}

	function formatLocaleMix(counts: { de?: number; en?: number } | undefined): string {
		const de = counts?.de ?? 0;
		const en = counts?.en ?? 0;
		if (de === 0 && en === 0) return '–';
		return `${de} / ${en}`;
	}

	function avgHintsPerAttempt(total: number, attempts: number): string {
		if (!attempts) return '0';
		return (total / attempts).toFixed(1);
	}

	async function handleExportCsv() {
		exporting = true;
		try {
			const data = await exportCourseAttempts({ courseId }).run();
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
		} catch (e) {
			console.error('Export CSV failed', e);
			showError(getLabel('analytics_export_failed', 'Export failed. Please try again.'));
		} finally {
			exporting = false;
		}
	}

	async function handleExportJson() {
		exporting = true;
		try {
			const data = await exportCourseAttempts({ courseId }).run();
			if (!data?.rows?.length) {
				showInfo(i18n.analytics_no_attempts);
				return;
			}

			downloadFile(JSON.stringify(data, null, 2), `${courseId}-attempts.json`, 'application/json');
		} catch (e) {
			console.error('Export JSON failed', e);
			showError(getLabel('analytics_export_failed', 'Export failed. Please try again.'));
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
	</div>

	<Boundary>
		{@const data = analyticsData as any}
		{#if data}
			<!-- Summary Cards -->
			<div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
				<div class="stat border-none rounded-lg bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_exercises}</div>
					<div class="stat-value text-2xl">{data.exerciseCount}</div>
				</div>
				<div class="stat border-none rounded-lg bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_attempts}</div>
					<div class="stat-value text-2xl">{data.totals.attempts}</div>
				</div>
				<div class="stat border-none rounded-lg bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_students}</div>
					<div class="stat-value text-2xl">{data.totals.students}</div>
				</div>
				<div class="stat border-none rounded-lg bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_avg_score}</div>
					<div class="stat-value text-2xl">{data.totals.avgScore}%</div>
				</div>
				<div class="stat border-none rounded-lg bg-base-300">
					<div class="stat-title">
						{getLabel('analytics_summary_avg_blocks', 'Avg. blocks')}
					</div>
					<div class="stat-value text-2xl">{data.totals.avgWorkspaceBlockCount ?? 0}</div>
				</div>
				<div class="stat border-none rounded-lg bg-base-300">
					<div class="stat-title">
						{getLabel('analytics_summary_avg_code_length', 'Avg. code length')}
					</div>
					<div class="stat-value text-2xl">{data.totals.avgGeneratedCodeLength ?? 0}</div>
				</div>
				<div class="stat border-none rounded-lg bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_avg_duration}</div>
					<div class="stat-value text-2xl">{formatDuration(data.totals.avgDurationMs ?? 0)}</div>
				</div>
				<div class="stat border-none rounded-lg bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_avg_hints}</div>
					<div class="stat-value text-2xl">
						{avgHintsPerAttempt(data.totals.hintUsageCount ?? 0, data.totals.attempts ?? 0)}
					</div>
				</div>
				<div class="stat border-none rounded-lg bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_locale_mix}</div>
					<div class="stat-value text-2xl">{formatLocaleMix(data.totals.localeCounts)}</div>
				</div>
			</div>

			<!-- Per-Exercise Table -->
			{#if data.exercises?.length}
				<div class="overflow-x-auto rounded-lg border border-base-300">
					<table class="table">
						<thead>
							<tr>
								<th title={i18n.analytics_tooltip_exercise}>{i18n.analytics_table_exercise}</th>
								<th title={i18n.analytics_tooltip_type}>{i18n.analytics_table_type}</th>
								<th title={i18n.analytics_tooltip_attempts}>{i18n.analytics_table_attempts}</th>
								<th title={i18n.analytics_tooltip_students}>{i18n.analytics_table_students}</th>
								<th title={i18n.analytics_tooltip_pass_rate}>{i18n.analytics_table_pass_rate}</th>
								<th title={i18n.analytics_tooltip_avg_score}>{i18n.analytics_table_avg_score}</th>
								<th title={i18n.analytics_tooltip_avg_blocks}>
									{getLabel('analytics_table_avg_blocks', 'Avg. blocks')}
								</th>
								<th title={i18n.analytics_tooltip_avg_code}>
									{getLabel('analytics_table_avg_code_length', 'Avg. code')}
								</th>
								<th title={i18n.analytics_tooltip_avg_duration}>
									{i18n.analytics_table_avg_duration}
								</th>
								<th title={i18n.analytics_tooltip_avg_hints}>{i18n.analytics_table_avg_hints}</th>
								<th title={i18n.analytics_tooltip_locale}>{i18n.analytics_table_locale}</th>
							</tr>
						</thead>
						<tbody>
							{#each data.exercises as ex (ex.exerciseId)}
								<tr>
									<td class="font-medium">{getLocalized(ex.title)}</td>
									<td>
										<span
											class="text-lg"
											title={getExerciseTypeLabel(ex.type)}
											aria-label={getExerciseTypeLabel(ex.type)}
										>
											{getExerciseTypeIcon(ex.type)}
										</span>
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
									<td>{formatDuration(ex.avgDurationMs ?? 0)}</td>
									<td>{avgHintsPerAttempt(ex.hintUsageCount ?? 0, ex.attempts ?? 0)}</td>
									<td class="whitespace-nowrap">{formatLocaleMix(ex.localeCounts)}</td>
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
