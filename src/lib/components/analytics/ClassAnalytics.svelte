<script lang="ts">
	import { getClassAnalytics, exportClassAttempts } from '$remote/analytics.remote';
	import { i18n } from '$lib/i18n/index.svelte';
	import { MoveLeft, Download, BarChart3, Users } from '@lucide/svelte';
	import Boundary from '$cp/Boundary.svelte';
	import DataTable, { type Column } from '$cp/DataTable.svelte';
	import ColumnPicker from '$cp/ColumnPicker.svelte';
	import { showError, showInfo } from '$lib/utils/toast';
	import { PersistedState } from 'runed';
	import type { ClassAnalyticsStudent } from '$lib/analytics/class-analytics';

	type Props = {
		classId: string;
		onBack: () => void;
		onSelectStudent: (studentId: string) => void;
	};

	let { classId, onBack, onSelectStudent }: Props = $props();

	let analytics = $derived(getClassAnalytics({ classId }));
	let data = $derived(analytics.current ?? null);
	let exporting = $state(false);
	let search = $state('');

	function getLabel(key: string, fallback: string) {
		return (i18n as Record<string, string | undefined>)[key] ?? fallback;
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

	function formatTimestamp(ms: number | null): string {
		if (!ms) return '–';
		const date = new Date(ms);
		return date.toLocaleString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function downloadFile(content: BlobPart, filename: string, type: string) {
		const blob = new Blob([content], { type });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			a.remove();
			URL.revokeObjectURL(url);
		}, 0);
	}

	async function handleExportCsv() {
		exporting = true;
		try {
			const out = await exportClassAttempts({ classId }).run();
			if (!out?.rows?.length) {
				showInfo(i18n.analytics_no_attempts);
				return;
			}
			const headers = [
				'attemptId',
				'classId',
				'className',
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
			const csv = [
				headers.join(','),
				...out.rows.map((row: Record<string, unknown>) =>
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
			downloadFile(csv.join('\n'), `${classId}-attempts.csv`, 'text/csv;charset=utf-8;');
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
			const out = await exportClassAttempts({ classId }).run();
			if (!out?.rows?.length) {
				showInfo(i18n.analytics_no_attempts);
				return;
			}
			downloadFile(JSON.stringify(out, null, 2), `${classId}-attempts.json`, 'application/json');
		} catch (e) {
			console.error('Export JSON failed', e);
			showError(getLabel('analytics_export_failed', 'Export failed. Please try again.'));
		} finally {
			exporting = false;
		}
	}

	type StudentRow = ClassAnalyticsStudent & { id: string };
	const studentRows = $derived<StudentRow[]>(
		(data?.students ?? []).map((s) => ({ ...s, id: s.userId }))
	);
	const totalExercises = $derived(data?.exerciseCount ?? 0);

	const columns = $derived<Column<StudentRow>[]>([
		{
			key: 'name',
			label: getLabel('analytics_students_table_name', 'Student'),
			sortable: true,
			resizable: true,
			searchable: true,
			defaultWidth: 200,
			render: (r) => r.name
		},
		{
			key: 'email',
			label: getLabel('analytics_students_table_email', 'Email'),
			sortable: true,
			resizable: true,
			searchable: true,
			defaultWidth: 240,
			cellSnippet: 'email',
			render: (r) => r.email
		},
		{
			key: 'attempts',
			label: i18n.analytics_table_attempts,
			sortable: true,
			resizable: true,
			defaultWidth: 110,
			render: (r) => String(r.attempts)
		},
		{
			key: 'exercises',
			label: getLabel('analytics_students_table_exercises', 'Exercises'),
			sortable: true,
			resizable: true,
			defaultWidth: 140,
			cellSnippet: 'exercises',
			render: (r) => String(r.exercisesPassed)
		},
		{
			key: 'passRate',
			label: i18n.analytics_table_pass_rate,
			sortable: true,
			resizable: true,
			defaultWidth: 150,
			cellSnippet: 'passRate',
			render: (r) => String(r.passRate)
		},
		{
			key: 'avgScore',
			label: i18n.analytics_table_avg_score,
			sortable: true,
			resizable: true,
			defaultWidth: 120,
			cellSnippet: 'avgScore',
			render: (r) => String(r.avgScore)
		},
		{
			key: 'avgDuration',
			label: i18n.analytics_table_avg_duration,
			sortable: true,
			resizable: true,
			defaultWidth: 130,
			cellSnippet: 'avgDuration',
			render: (r) => String(r.avgDurationMs)
		},
		{
			key: 'avgHints',
			label: i18n.analytics_table_avg_hints,
			sortable: true,
			resizable: true,
			defaultWidth: 110,
			cellSnippet: 'avgHints',
			render: (r) => (r.attempts > 0 ? (r.hintUsageCount / r.attempts).toFixed(1) : '0')
		},
		{
			key: 'locale',
			label: i18n.analytics_table_locale,
			resizable: true,
			defaultWidth: 100,
			cellSnippet: 'locale',
			render: (r) => formatLocaleMix(r.localeCounts)
		},
		{
			key: 'lastAttempt',
			label: getLabel('analytics_students_table_last_attempt', 'Last attempt'),
			sortable: true,
			resizable: true,
			defaultWidth: 160,
			cellSnippet: 'lastAttempt',
			render: (r) => String(r.lastAttemptAt ?? 0)
		}
	]);

	const allColumnKeys = $derived(columns.map((c) => c.key));
	const visibleColumns = new PersistedState<string[]>(
		'analytics.students.visibleColumns',
		[
			'name',
			'email',
			'attempts',
			'exercises',
			'passRate',
			'avgScore',
			'avgDuration',
			'avgHints',
			'locale',
			'lastAttempt'
		]
	);
	const colWidths = new PersistedState<Record<string, number>>(
		'analytics.students.colWidths',
		{}
	);

	$effect(() => {
		const keys = allColumnKeys;
		const current = visibleColumns.current;
		if (current.some((k) => !keys.includes(k))) {
			visibleColumns.current = current.filter((k) => keys.includes(k));
		}
	});
</script>

<div class="p-4">
	<div class="mb-4 flex items-center gap-4">
		<button class="btn btn-ghost btn-sm" onclick={onBack}>
			<MoveLeft size="20" />
		</button>
		<div>
			<h2 class="text-xl font-bold">{data?.className ?? ''}</h2>
			<p class="text-sm text-base-content/60">
				{getLabel('analytics_class_subtitle', 'Per-student rollup across all assigned courses.')}
			</p>
		</div>
		<div class="flex-1"></div>
		<button class="btn btn-sm btn-primary" onclick={handleExportCsv} disabled={exporting}>
			<Download size="16" />
			{exporting
				? getLabel('analytics_exporting', 'Exporting...')
				: getLabel('analytics_export_csv', 'Export CSV')}
		</button>
		<button class="btn btn-sm btn-outline" onclick={handleExportJson} disabled={exporting}>
			<Download size="16" />
			{exporting
				? getLabel('analytics_exporting', 'Exporting...')
				: getLabel('analytics_export_json', 'Export JSON')}
		</button>
	</div>

	<Boundary>
		{#if data}
			<div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{getLabel('analytics_classes_card_enrolled', 'Enrolled')}</div>
					<div class="stat-value text-2xl">{data.enrolledStudents}</div>
				</div>
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_exercises}</div>
					<div class="stat-value text-2xl">{data.exerciseCount}</div>
				</div>
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_attempts}</div>
					<div class="stat-value text-2xl">{data.totals.attempts}</div>
				</div>
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_students}</div>
					<div class="stat-value text-2xl">{data.totals.students}</div>
				</div>
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{i18n.analytics_table_pass_rate}</div>
					<div class="stat-value text-2xl">{data.totals.passRate}%</div>
				</div>
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_avg_score}</div>
					<div class="stat-value text-2xl">{data.totals.avgScore}%</div>
				</div>
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_avg_duration}</div>
					<div class="stat-value text-2xl">{formatDuration(data.totals.avgDurationMs)}</div>
				</div>
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_avg_hints}</div>
					<div class="stat-value text-2xl">
						{avgHintsPerAttempt(data.totals.hintUsageCount, data.totals.attempts)}
					</div>
				</div>
			</div>

			{#if data.students.length === 0}
				<div class="rounded-lg border-2 border-dashed border-base-300 p-8 text-center">
					<Users class="mx-auto h-12 w-12 text-base-content/30" />
					<p class="mt-2 text-base-content/60">
						{getLabel('analytics_no_students', 'No students enrolled in this class yet.')}
					</p>
				</div>
			{:else}
				<div class="mb-3 flex flex-wrap items-center justify-end gap-3">
					<ColumnPicker {columns} bind:visibleColumns={visibleColumns.current} />
				</div>
				<DataTable
					items={studentRows}
					{columns}
					bind:visibleColumns={visibleColumns.current}
					bind:searchQuery={search}
					bind:colWidths={colWidths.current}
					searchPlaceholder={getLabel('analytics_students_search', 'Search students')}
					emptyMessage={getLabel('analytics_no_students', 'No students to show.')}
					onRowClick={(row) => onSelectStudent(row.userId)}
					pageSize={25}
					cellSnippets={{
						email: emailCell,
						exercises: exercisesCell,
						passRate: passRateCell,
						avgScore: avgScoreCell,
						avgDuration: avgDurationCell,
						avgHints: avgHintsCell,
						locale: localeCell,
						lastAttempt: lastAttemptCell
					}}
				/>
			{/if}

			{#if data.exerciseCount === 0}
				<div class="mt-4 rounded-lg border-2 border-dashed border-base-300 p-4 text-center">
					<BarChart3 class="mx-auto h-8 w-8 text-base-content/30" />
					<p class="mt-2 text-sm text-base-content/60">
						{getLabel(
							'analytics_class_no_exercises',
							'No courses or exercises are assigned to this class yet.'
						)}
					</p>
				</div>
			{/if}
		{/if}
	</Boundary>
</div>

{#snippet emailCell(row: StudentRow)}
	<span class="text-sm text-base-content/70">{row.email}</span>
{/snippet}

{#snippet exercisesCell(row: StudentRow)}
	<span class="text-sm">
		{row.exercisesAttempted} / {row.exercisesPassed} / {totalExercises}
	</span>
{/snippet}

{#snippet passRateCell(row: StudentRow)}
	{#if row.attempts > 0}
		<div class="flex items-center gap-2">
			<progress
				class="progress w-16"
				class:progress-success={row.passRate >= 70}
				class:progress-warning={row.passRate >= 40 && row.passRate < 70}
				class:progress-error={row.passRate < 40}
				value={row.passRate}
				max="100"
			></progress>
			<span class="text-sm">{row.passRate}%</span>
		</div>
	{:else}
		<span class="text-base-content/40">–</span>
	{/if}
{/snippet}

{#snippet avgScoreCell(row: StudentRow)}
	{row.attempts > 0 ? `${row.avgScore}%` : '–'}
{/snippet}

{#snippet avgDurationCell(row: StudentRow)}
	{formatDuration(row.avgDurationMs)}
{/snippet}

{#snippet avgHintsCell(row: StudentRow)}
	{avgHintsPerAttempt(row.hintUsageCount, row.attempts)}
{/snippet}

{#snippet localeCell(row: StudentRow)}
	<span class="whitespace-nowrap">{formatLocaleMix(row.localeCounts)}</span>
{/snippet}

{#snippet lastAttemptCell(row: StudentRow)}
	<span class="whitespace-nowrap text-sm">{formatTimestamp(row.lastAttemptAt)}</span>
{/snippet}
