<script lang="ts">
	import { getStudentClassAnalytics } from '$remote/analytics.remote';
	import { getLocalized, i18n } from '$lib/i18n/index.svelte';
	import { MoveLeft, BarChart3 } from '@lucide/svelte';
	import Boundary from '$cp/Boundary.svelte';
	import DataTable, { type Column } from '$cp/DataTable.svelte';
	import ColumnPicker from '$cp/ColumnPicker.svelte';
	import { PersistedState } from 'runed';
	import type { CourseAnalyticsExercise } from '$lib/analytics/course-analytics';

	type Props = {
		classId: string;
		userId: string;
		onBack: () => void;
	};

	let { classId, userId, onBack }: Props = $props();

	let analytics = $derived(getStudentClassAnalytics({ classId, userId }));
	let data = $derived(analytics.current ?? null);

	let search = $state('');

	function getLabel(key: string, fallback: string) {
		return (i18n as Record<string, string | undefined>)[key] ?? fallback;
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

	type ExerciseRow = CourseAnalyticsExercise & { id: string };
	const exerciseRows = $derived<ExerciseRow[]>(
		(data?.exercises ?? []).map((e) => ({ ...e, id: e.exerciseId }))
	);

	const columns = $derived<Column<ExerciseRow>[]>([
		{
			key: 'exercise',
			label: i18n.analytics_table_exercise,
			sortable: true,
			resizable: true,
			searchable: true,
			defaultWidth: 240,
			cellSnippet: 'exercise',
			render: (r) => getLocalized(r.title)
		},
		{
			key: 'type',
			label: i18n.analytics_table_type,
			sortable: true,
			resizable: true,
			defaultWidth: 80,
			cellSnippet: 'type',
			render: (r) => r.type
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
			key: 'avgBlocks',
			label: getLabel('analytics_table_avg_blocks', 'Avg. blocks'),
			sortable: true,
			resizable: true,
			defaultWidth: 110,
			render: (r) => String(r.avgWorkspaceBlockCount)
		},
		{
			key: 'avgCode',
			label: getLabel('analytics_table_avg_code_length', 'Avg. code'),
			sortable: true,
			resizable: true,
			defaultWidth: 110,
			render: (r) => String(r.avgGeneratedCodeLength)
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
		}
	]);

	const allColumnKeys = $derived(columns.map((c) => c.key));
	const visibleColumns = new PersistedState<string[]>(
		'analytics.exercises.visibleColumns',
		[
			'exercise',
			'type',
			'attempts',
			'passRate',
			'avgScore',
			'avgBlocks',
			'avgCode',
			'avgDuration',
			'avgHints',
			'locale'
		]
	);
	const colWidths = new PersistedState<Record<string, number>>(
		'analytics.exercises.colWidths',
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
			<h2 class="text-xl font-bold">{data?.student.name ?? ''}</h2>
			<p class="text-sm text-base-content/60">
				<span>{data?.student.email ?? ''}</span>
				{#if data?.className}
					<span class="ml-2 badge badge-ghost badge-sm">{data.className}</span>
				{/if}
			</p>
		</div>
	</div>

	<Boundary>
		{#if data}
			<div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_exercises}</div>
					<div class="stat-value text-2xl">{data.exerciseCount}</div>
				</div>
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_attempts}</div>
					<div class="stat-value text-2xl">{data.totals.attempts}</div>
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
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{getLabel('analytics_summary_avg_blocks', 'Avg. blocks')}</div>
					<div class="stat-value text-2xl">{data.totals.avgWorkspaceBlockCount}</div>
				</div>
				<div class="stat rounded-lg border-none bg-base-300">
					<div class="stat-title">{i18n.analytics_summary_locale_mix}</div>
					<div class="stat-value text-2xl">{formatLocaleMix(data.totals.localeCounts)}</div>
				</div>
			</div>

			{#if exerciseRows.length > 0}
				<div class="mb-3 flex flex-wrap items-center justify-end gap-3">
					<ColumnPicker {columns} bind:visibleColumns={visibleColumns.current} />
				</div>
				<DataTable
					items={exerciseRows}
					{columns}
					bind:visibleColumns={visibleColumns.current}
					bind:searchQuery={search}
					bind:colWidths={colWidths.current}
					searchPlaceholder={getLabel('analytics_exercises_search', 'Search exercises')}
					emptyMessage={getLabel(
						'analytics_student_no_exercises',
						'No exercises are assigned to this class yet.'
					)}
					pageSize={25}
					cellSnippets={{
						exercise: exerciseCell,
						type: typeCell,
						passRate: passRateCell,
						avgScore: avgScoreCell,
						avgDuration: avgDurationCell,
						avgHints: avgHintsCell,
						locale: localeCell
					}}
				/>
			{:else}
				<div class="rounded-lg border-2 border-dashed border-base-300 p-8 text-center">
					<BarChart3 class="mx-auto h-12 w-12 text-base-content/30" />
					<p class="mt-2 text-base-content/60">
						{getLabel(
							'analytics_student_no_exercises',
							'No exercises are assigned to this class yet.'
						)}
					</p>
				</div>
			{/if}
		{/if}
	</Boundary>
</div>

{#snippet exerciseCell(row: ExerciseRow)}
	<span class="font-medium">{getLocalized(row.title)}</span>
{/snippet}

{#snippet typeCell(row: ExerciseRow)}
	<span
		class="text-lg"
		title={getExerciseTypeLabel(row.type)}
		aria-label={getExerciseTypeLabel(row.type)}
	>
		{getExerciseTypeIcon(row.type)}
	</span>
{/snippet}

{#snippet passRateCell(row: ExerciseRow)}
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

{#snippet avgScoreCell(row: ExerciseRow)}
	{row.attempts > 0 ? `${row.avgScore}%` : '–'}
{/snippet}

{#snippet avgDurationCell(row: ExerciseRow)}
	{formatDuration(row.avgDurationMs)}
{/snippet}

{#snippet avgHintsCell(row: ExerciseRow)}
	{avgHintsPerAttempt(row.hintUsageCount, row.attempts)}
{/snippet}

{#snippet localeCell(row: ExerciseRow)}
	<span class="whitespace-nowrap">{formatLocaleMix(row.localeCounts)}</span>
{/snippet}
