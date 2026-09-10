import type { AttemptAnalytics } from '$lib/types/attempt';
import type { Exercise } from '$lib/types/exercise';
import type { attempts as attemptsTable, exercises as exercisesTable } from '$lib/server/db/schema';

type ExerciseRow = typeof exercisesTable.$inferSelect;
type AttemptRow = typeof attemptsTable.$inferSelect;

export type CourseAnalyticsTotals = {
	attempts: number;
	students: number;
	passRate: number;
	avgScore: number;
	avgWorkspaceBlockCount: number;
	avgGeneratedCodeLength: number;
	hintUsageCount: number;
	avgDurationMs: number;
	localeCounts: { de: number; en: number };
};

export type CourseAnalyticsExercise = {
	exerciseId: string;
	title: { de: string; en: string };
	type: Exercise['type'];
	attempts: number;
	students: number;
	passRate: number;
	avgScore: number;
	avgWorkspaceBlockCount: number;
	avgGeneratedCodeLength: number;
	hintUsageCount: number;
	avgDurationMs: number;
	localeCounts: { de: number; en: number };
};

export type CourseAnalytics = {
	exerciseCount: number;
	exercises: CourseAnalyticsExercise[];
	totals: CourseAnalyticsTotals;
};

const EMPTY_TOTALS: CourseAnalyticsTotals = {
	attempts: 0,
	students: 0,
	passRate: 0,
	avgScore: 0,
	avgWorkspaceBlockCount: 0,
	avgGeneratedCodeLength: 0,
	hintUsageCount: 0,
	avgDurationMs: 0,
	localeCounts: { de: 0, en: 0 }
};

export function computeCourseAnalytics(input: {
	exerciseIds: string[];
	exerciseRows: ExerciseRow[];
	attemptRows: AttemptRow[];
	countHintEvents: (json: string) => number;
	parseAttemptAnalytics: (json: string, type: Exercise['type']) => AttemptAnalytics;
}): CourseAnalytics {
	const { exerciseIds, exerciseRows, attemptRows, countHintEvents, parseAttemptAnalytics } = input;

	if (exerciseIds.length === 0) {
		return { exerciseCount: 0, exercises: [], totals: EMPTY_TOTALS };
	}

	const exerciseMap = new Map(exerciseRows.map((e) => [e.id, e]));
	const allStudentIds = new Set<string>();
	const totals = { ...EMPTY_TOTALS, localeCounts: { de: 0, en: 0 } };
	let totalScore = 0;
	let totalPassed = 0;
	let totalDurationMs = 0;
	let totalWorkspaceBlockCount = 0;
	let totalGeneratedCodeLength = 0;

	const exercises = exerciseIds.map((exerciseId) => {
		const ex = exerciseMap.get(exerciseId);
		const type = (ex?.type ?? 'io') as Exercise['type'];
		const title =
			ex?.content &&
			typeof ex.content === 'object' &&
			'title' in (ex.content as Record<string, unknown>)
				? ((ex.content as Record<string, unknown>).title as { de: string; en: string })
				: { de: exerciseId, en: exerciseId };

		const rows = attemptRows.filter((a) => a.exerciseId === exerciseId);
		const studentIds = new Set(rows.map((a) => a.userId ?? a.clientId ?? '').filter(Boolean));
		studentIds.forEach((id) => allStudentIds.add(id));

		const passedCount = rows.filter((a) => a.passed).length;
		const avgScore =
			rows.length > 0 ? Math.round(rows.reduce((s, a) => s + a.score, 0) / rows.length) : 0;
		const hintUsageCount = rows.reduce((s, a) => s + countHintEvents(a.hintEventsJson), 0);
		const analytics = rows.map((a) => parseAttemptAnalytics(a.analyticsJson, type));
		const durationSum = rows.reduce(
			(s, a) => s + Math.max(0, a.endedAt - a.startedAt),
			0
		);
		const avgDurationMs = rows.length > 0 ? Math.round(durationSum / rows.length) : 0;
		const localeCounts = rows.reduce(
			(counts, a) => {
				counts[a.locale] += 1;
				return counts;
			},
			{ de: 0, en: 0 }
		);
		const workspaceBlockSum = analytics.reduce((s, a) => s + (a.workspaceBlockCount ?? 0), 0);
		const generatedCodeSum = analytics.reduce((s, a) => s + (a.generatedCodeLength ?? 0), 0);
		const avgWorkspaceBlockCount =
			rows.length > 0 ? Math.round(workspaceBlockSum / rows.length) : 0;
		const avgGeneratedCodeLength =
			rows.length > 0 ? Math.round(generatedCodeSum / rows.length) : 0;

		totals.attempts += rows.length;
		totalPassed += passedCount;
		totalScore += rows.reduce((s, a) => s + a.score, 0);
		totals.hintUsageCount += hintUsageCount;
		totalDurationMs += durationSum;
		totalWorkspaceBlockCount += workspaceBlockSum;
		totalGeneratedCodeLength += generatedCodeSum;
		totals.localeCounts.de += localeCounts.de;
		totals.localeCounts.en += localeCounts.en;

		return {
			exerciseId,
			title,
			type,
			attempts: rows.length,
			students: studentIds.size,
			passRate: rows.length > 0 ? Math.round((passedCount / rows.length) * 100) : 0,
			avgScore,
			avgWorkspaceBlockCount,
			avgGeneratedCodeLength,
			hintUsageCount,
			avgDurationMs,
			localeCounts
		};
	});

	totals.students = allStudentIds.size;
	totals.passRate = totals.attempts > 0 ? Math.round((totalPassed / totals.attempts) * 100) : 0;
	totals.avgScore = totals.attempts > 0 ? Math.round(totalScore / totals.attempts) : 0;
	totals.avgWorkspaceBlockCount =
		totals.attempts > 0 ? Math.round(totalWorkspaceBlockCount / totals.attempts) : 0;
	totals.avgGeneratedCodeLength =
		totals.attempts > 0 ? Math.round(totalGeneratedCodeLength / totals.attempts) : 0;
	totals.avgDurationMs =
		totals.attempts > 0 ? Math.round(totalDurationMs / totals.attempts) : 0;

	return { exerciseCount: exerciseIds.length, exercises, totals };
}
