<script lang="ts">
	import { getClassesAnalytics } from '$remote/analytics.remote';
	import { i18n } from '$lib/i18n/index.svelte';
	import { BarChart3 } from '@lucide/svelte';
	import Boundary from '$cp/Boundary.svelte';
	import DataTable, { type Column } from '$cp/DataTable.svelte';
	import ColumnPicker from '$cp/ColumnPicker.svelte';
	import { PersistedState } from 'runed';
	import type { ClassAnalyticsSummary } from '$lib/analytics/class-analytics';

	type Props = {
		onSelectClass: (classId: string) => void;
	};

	let { onSelectClass }: Props = $props();

	let classes = $derived(getClassesAnalytics());
	let classesData = $derived<ClassAnalyticsSummary[]>(classes.current ?? []);

	let search = $state('');
	let showArchived = $state(false);

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

	function formatTimestamp(ms: number | null): string {
		if (!ms) return '–';
		const date = new Date(ms);
		return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
	}

	const visibleRows = $derived.by(() => {
		const rows = classesData.filter((c) => showArchived || c.archivedAt == null);
		return rows.map((row) => ({ ...row, id: row.classId }));
	});

	const overallTotals = $derived.by(() => {
		const rows = visibleRows;
		const attempts = rows.reduce((s, r) => s + r.totals.attempts, 0);
		const students = rows.reduce((s, r) => s + r.totals.students, 0);
		const enrolled = rows.reduce((s, r) => s + r.totals.enrolledStudents, 0);
		const totalPassed = rows.reduce(
			(s, r) => s + Math.round((r.totals.passRate / 100) * r.totals.attempts),
			0
		);
		const passRate = attempts > 0 ? Math.round((totalPassed / attempts) * 100) : 0;
		const scoreSum = rows.reduce((s, r) => s + r.totals.avgScore * r.totals.attempts, 0);
		const avgScore = attempts > 0 ? Math.round(scoreSum / attempts) : 0;
		return { attempts, students, enrolled, passRate, avgScore };
	});

	type ClassRow = ClassAnalyticsSummary & { id: string };

	const columns = $derived<Column<ClassRow>[]>([
		{
			key: 'className',
			label: getLabel('analytics_classes_table_name', 'Class'),
			sortable: true,
			resizable: true,
			searchable: true,
			defaultWidth: 220,
			cellSnippet: 'className',
			render: (r) => r.className
		},
		{
			key: 'enrolledStudents',
			label: getLabel('analytics_classes_table_enrolled', 'Enrolled'),
			sortable: true,
			resizable: true,
			defaultWidth: 110,
			render: (r) => String(r.enrolledStudents)
		},
		{
			key: 'courseCount',
			label: getLabel('analytics_classes_table_courses', 'Courses'),
			sortable: true,
			resizable: true,
			defaultWidth: 100,
			render: (r) => String(r.courseCount)
		},
		{
			key: 'exerciseCount',
			label: getLabel('analytics_classes_table_exercises', 'Exercises'),
			sortable: true,
			resizable: true,
			defaultWidth: 110,
			render: (r) => String(r.exerciseCount)
		},
		{
			key: 'attempts',
			label: i18n.analytics_table_attempts,
			sortable: true,
			resizable: true,
			defaultWidth: 110,
			render: (r) => String(r.totals.attempts)
		},
		{
			key: 'activeStudents',
			label: getLabel('analytics_classes_table_active_students', 'Active students'),
			sortable: true,
			resizable: true,
			defaultWidth: 140,
			cellSnippet: 'activeStudents',
			render: (r) => String(r.totals.students)
		},
		{
			key: 'passRate',
			label: i18n.analytics_table_pass_rate,
			sortable: true,
			resizable: true,
			defaultWidth: 150,
			cellSnippet: 'passRate',
			render: (r) => String(r.totals.passRate)
		},
		{
			key: 'avgScore',
			label: i18n.analytics_table_avg_score,
			sortable: true,
			resizable: true,
			defaultWidth: 120,
			cellSnippet: 'avgScore',
			render: (r) => String(r.totals.avgScore)
		},
		{
			key: 'avgDuration',
			label: i18n.analytics_table_avg_duration,
			sortable: true,
			resizable: true,
			defaultWidth: 130,
			cellSnippet: 'avgDuration',
			render: (r) => String(r.totals.avgDurationMs)
		},
		{
			key: 'lastActivity',
			label: getLabel('analytics_classes_table_last_activity', 'Last activity'),
			sortable: true,
			resizable: true,
			defaultWidth: 150,
			cellSnippet: 'lastActivity',
			render: (r) => String(r.lastActivityAt ?? 0)
		}
	]);

	const allColumnKeys = $derived(columns.map((c) => c.key));
	const visibleColumns = new PersistedState<string[]>(
		'analytics.classes.visibleColumns',
		[
			'className',
			'enrolledStudents',
			'courseCount',
			'exerciseCount',
			'attempts',
			'activeStudents',
			'passRate',
			'avgScore',
			'avgDuration',
			'lastActivity'
		]
	);
	const colWidths = new PersistedState<Record<string, number>>(
		'analytics.classes.colWidths',
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
		<div>
			<h2 class="text-xl font-bold">{getLabel('analytics_classes_title', 'Class analytics')}</h2>
			<p class="text-sm text-base-content/60">
				{getLabel(
					'analytics_classes_subtitle',
					'Overview of every class with attempt rollups across all assigned courses.'
				)}
			</p>
		</div>
	</div>

	<Boundary>
		<div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
			<div class="stat rounded-lg border-none bg-base-300">
				<div class="stat-title">{getLabel('analytics_classes_card_total', 'Classes')}</div>
				<div class="stat-value text-2xl">{visibleRows.length}</div>
			</div>
			<div class="stat rounded-lg border-none bg-base-300">
				<div class="stat-title">{getLabel('analytics_classes_card_enrolled', 'Enrolled')}</div>
				<div class="stat-value text-2xl">{overallTotals.enrolled}</div>
			</div>
			<div class="stat rounded-lg border-none bg-base-300">
				<div class="stat-title">{i18n.analytics_summary_attempts}</div>
				<div class="stat-value text-2xl">{overallTotals.attempts}</div>
			</div>
			<div class="stat rounded-lg border-none bg-base-300">
				<div class="stat-title">{i18n.analytics_table_pass_rate}</div>
				<div class="stat-value text-2xl">{overallTotals.passRate}%</div>
			</div>
			<div class="stat rounded-lg border-none bg-base-300">
				<div class="stat-title">{i18n.analytics_summary_avg_score}</div>
				<div class="stat-value text-2xl">{overallTotals.avgScore}%</div>
			</div>
		</div>

		<div class="mb-3 flex flex-wrap items-center gap-3">
			<label class="label cursor-pointer gap-2">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={showArchived} />
				<span class="label-text">{getLabel('analytics_show_archived', 'Show archived')}</span>
			</label>
			<div class="flex-1"></div>
			<ColumnPicker {columns} bind:visibleColumns={visibleColumns.current} />
		</div>

		{#if visibleRows.length === 0}
			<div class="rounded-lg border-2 border-dashed border-base-300 p-8 text-center">
				<BarChart3 class="mx-auto h-12 w-12 text-base-content/30" />
				<p class="mt-2 text-base-content/60">
					{getLabel('analytics_no_classes', 'No classes to show.')}
				</p>
			</div>
		{:else}
			<DataTable
				items={visibleRows}
				{columns}
				bind:visibleColumns={visibleColumns.current}
				bind:searchQuery={search}
				bind:colWidths={colWidths.current}
				searchPlaceholder={getLabel('analytics_classes_search', 'Search classes')}
				emptyMessage={getLabel('analytics_no_classes', 'No classes to show.')}
				onRowClick={(row) => onSelectClass(row.classId)}
				pageSize={25}
				cellSnippets={{
					className: classNameCell,
					activeStudents: activeStudentsCell,
					passRate: passRateCell,
					avgScore: avgScoreCell,
					avgDuration: avgDurationCell,
					lastActivity: lastActivityCell
				}}
			/>
		{/if}
	</Boundary>
</div>

{#snippet classNameCell(row: ClassRow)}
	<div class="flex flex-col">
		<div class="flex items-center gap-2">
			<span class="font-medium" class:opacity-50={row.archivedAt != null}>{row.className}</span>
			{#if row.archivedAt != null}
				<span class="badge badge-ghost badge-sm">
					{getLabel('analytics_badge_archived', 'archived')}
				</span>
			{/if}
		</div>
		{#if row.description}
			<span class="truncate text-xs text-base-content/50">{row.description}</span>
		{/if}
	</div>
{/snippet}

{#snippet activeStudentsCell(row: ClassRow)}
	<span>{row.totals.students}</span>
	{#if row.enrolledStudents > 0}
		<span class="text-xs text-base-content/50">/ {row.enrolledStudents}</span>
	{/if}
{/snippet}

{#snippet passRateCell(row: ClassRow)}
	{#if row.totals.attempts > 0}
		<div class="flex items-center gap-2">
			<progress
				class="progress w-16"
				class:progress-success={row.totals.passRate >= 70}
				class:progress-warning={row.totals.passRate >= 40 && row.totals.passRate < 70}
				class:progress-error={row.totals.passRate < 40}
				value={row.totals.passRate}
				max="100"
			></progress>
			<span class="text-sm">{row.totals.passRate}%</span>
		</div>
	{:else}
		<span class="text-base-content/40">–</span>
	{/if}
{/snippet}

{#snippet avgScoreCell(row: ClassRow)}
	{row.totals.attempts > 0 ? `${row.totals.avgScore}%` : '–'}
{/snippet}

{#snippet avgDurationCell(row: ClassRow)}
	{formatDuration(row.totals.avgDurationMs)}
{/snippet}

{#snippet lastActivityCell(row: ClassRow)}
	<span class="whitespace-nowrap text-sm">{formatTimestamp(row.lastActivityAt)}</span>
{/snippet}
