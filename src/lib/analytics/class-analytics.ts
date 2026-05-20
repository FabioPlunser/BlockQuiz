import type { AttemptAnalytics } from '$lib/types/attempt';
import type { Exercise } from '$lib/types/exercise';
import type { attempts as attemptsTable, exercises as exercisesTable } from '$lib/server/db/schema';

type ExerciseRow = typeof exercisesTable.$inferSelect;
type AttemptRow = typeof attemptsTable.$inferSelect;

export type ClassAnalyticsTotals = {
	attempts: number;
	students: number;
	enrolledStudents: number;
	passRate: number;
	avgScore: number;
	avgWorkspaceBlockCount: number;
	avgGeneratedCodeLength: number;
	hintUsageCount: number;
	avgDurationMs: number;
	localeCounts: { de: number; en: number };
};

export type ClassAnalyticsSummary = {
	classId: string;
	className: string;
	description: string | null;
	archivedAt: number | null;
	enrolledStudents: number;
	courseCount: number;
	exerciseCount: number;
	totals: ClassAnalyticsTotals;
	lastActivityAt: number | null;
};

export type ClassAnalyticsStudent = {
	userId: string;
	name: string;
	email: string;
	attempts: number;
	exercisesAttempted: number;
	exercisesPassed: number;
	passRate: number;
	avgScore: number;
	avgWorkspaceBlockCount: number;
	avgGeneratedCodeLength: number;
	hintUsageCount: number;
	avgDurationMs: number;
	lastAttemptAt: number | null;
	localeCounts: { de: number; en: number };
};

export type ClassAnalytics = {
	classId: string;
	className: string;
	description: string | null;
	archivedAt: number | null;
	enrolledStudents: number;
	courseCount: number;
	exerciseCount: number;
	totals: ClassAnalyticsTotals;
	students: ClassAnalyticsStudent[];
};

const EMPTY_TOTALS = (): ClassAnalyticsTotals => ({
	attempts: 0,
	students: 0,
	enrolledStudents: 0,
	passRate: 0,
	avgScore: 0,
	avgWorkspaceBlockCount: 0,
	avgGeneratedCodeLength: 0,
	hintUsageCount: 0,
	avgDurationMs: 0,
	localeCounts: { de: 0, en: 0 }
});

type Helpers = {
	countHintEvents: (json: string) => number;
	parseAttemptAnalytics: (json: string, type: Exercise['type']) => AttemptAnalytics;
};

type Aggregate = {
	attempts: number;
	totalScore: number;
	totalPassed: number;
	totalDurationMs: number;
	totalWorkspaceBlockCount: number;
	totalGeneratedCodeLength: number;
	hintUsageCount: number;
	localeCounts: { de: number; en: number };
	lastAttemptAt: number | null;
};

function emptyAggregate(): Aggregate {
	return {
		attempts: 0,
		totalScore: 0,
		totalPassed: 0,
		totalDurationMs: 0,
		totalWorkspaceBlockCount: 0,
		totalGeneratedCodeLength: 0,
		hintUsageCount: 0,
		localeCounts: { de: 0, en: 0 },
		lastAttemptAt: null
	};
}

function accumulate(
	agg: Aggregate,
	attempt: AttemptRow,
	exerciseType: Exercise['type'],
	helpers: Helpers
) {
	const analytics = helpers.parseAttemptAnalytics(attempt.analyticsJson, exerciseType);
	agg.attempts += 1;
	agg.totalScore += attempt.score;
	if (attempt.passed) agg.totalPassed += 1;
	agg.totalDurationMs += Math.max(0, attempt.endedAt - attempt.startedAt);
	agg.totalWorkspaceBlockCount += analytics.workspaceBlockCount ?? 0;
	agg.totalGeneratedCodeLength += analytics.generatedCodeLength ?? 0;
	agg.hintUsageCount += helpers.countHintEvents(attempt.hintEventsJson);
	agg.localeCounts[attempt.locale] += 1;
	if (agg.lastAttemptAt == null || attempt.createdAt > agg.lastAttemptAt) {
		agg.lastAttemptAt = attempt.createdAt;
	}
}

function totalsFrom(agg: Aggregate, students: number, enrolledStudents: number): ClassAnalyticsTotals {
	const { attempts } = agg;
	const round = (sum: number) => (attempts > 0 ? Math.round(sum / attempts) : 0);
	return {
		attempts,
		students,
		enrolledStudents,
		passRate: attempts > 0 ? Math.round((agg.totalPassed / attempts) * 100) : 0,
		avgScore: round(agg.totalScore),
		avgWorkspaceBlockCount: round(agg.totalWorkspaceBlockCount),
		avgGeneratedCodeLength: round(agg.totalGeneratedCodeLength),
		hintUsageCount: agg.hintUsageCount,
		avgDurationMs: round(agg.totalDurationMs),
		localeCounts: agg.localeCounts
	};
}

export type ClassAnalyticsListInput = {
	classes: Array<{
		classId: string;
		className: string;
		description: string | null;
		archivedAt: number | null;
		courseIds: string[];
		exerciseIds: string[];
		enrolledUserIds: string[];
	}>;
	exerciseRows: ExerciseRow[];
	attemptRows: AttemptRow[];
} & Helpers;

export function computeClassAnalyticsList(input: ClassAnalyticsListInput): ClassAnalyticsSummary[] {
	const exerciseMap = new Map(input.exerciseRows.map((e) => [e.id, e]));

	return input.classes.map((cls) => {
		const exerciseIdSet = new Set(cls.exerciseIds);
		const userIdSet = new Set(cls.enrolledUserIds);
		const agg = emptyAggregate();
		const studentIds = new Set<string>();

		for (const a of input.attemptRows) {
			if (!a.userId) continue;
			if (!userIdSet.has(a.userId)) continue;
			if (!exerciseIdSet.has(a.exerciseId)) continue;
			const ex = exerciseMap.get(a.exerciseId);
			const type = (ex?.type ?? 'io') as Exercise['type'];
			accumulate(agg, a, type, input);
			studentIds.add(a.userId);
		}

		return {
			classId: cls.classId,
			className: cls.className,
			description: cls.description,
			archivedAt: cls.archivedAt,
			enrolledStudents: cls.enrolledUserIds.length,
			courseCount: cls.courseIds.length,
			exerciseCount: cls.exerciseIds.length,
			totals: totalsFrom(agg, studentIds.size, cls.enrolledUserIds.length),
			lastActivityAt: agg.lastAttemptAt
		};
	});
}

export type ClassAnalyticsInput = {
	classId: string;
	className: string;
	description: string | null;
	archivedAt: number | null;
	exerciseIds: string[];
	courseIds: string[];
	enrolledUsers: Array<{ id: string; name: string | null; email: string }>;
	exerciseRows: ExerciseRow[];
	attemptRows: AttemptRow[];
} & Helpers;

export function computeClassAnalytics(input: ClassAnalyticsInput): ClassAnalytics {
	const exerciseMap = new Map(input.exerciseRows.map((e) => [e.id, e]));
	const exerciseIdSet = new Set(input.exerciseIds);
	const userMap = new Map(input.enrolledUsers.map((u) => [u.id, u]));

	const classAgg = emptyAggregate();
	const perStudentAgg = new Map<string, Aggregate>();
	const perStudentExercises = new Map<string, Set<string>>();
	const perStudentPassedExercises = new Map<string, Set<string>>();
	const studentsWithAttempts = new Set<string>();

	for (const a of input.attemptRows) {
		if (!a.userId) continue;
		if (!userMap.has(a.userId)) continue;
		if (!exerciseIdSet.has(a.exerciseId)) continue;
		const ex = exerciseMap.get(a.exerciseId);
		const type = (ex?.type ?? 'io') as Exercise['type'];

		accumulate(classAgg, a, type, input);
		studentsWithAttempts.add(a.userId);

		let studentAgg = perStudentAgg.get(a.userId);
		if (!studentAgg) {
			studentAgg = emptyAggregate();
			perStudentAgg.set(a.userId, studentAgg);
		}
		accumulate(studentAgg, a, type, input);

		let attemptedSet = perStudentExercises.get(a.userId);
		if (!attemptedSet) {
			attemptedSet = new Set();
			perStudentExercises.set(a.userId, attemptedSet);
		}
		attemptedSet.add(a.exerciseId);

		if (a.passed) {
			let passedSet = perStudentPassedExercises.get(a.userId);
			if (!passedSet) {
				passedSet = new Set();
				perStudentPassedExercises.set(a.userId, passedSet);
			}
			passedSet.add(a.exerciseId);
		}
	}

	const students: ClassAnalyticsStudent[] = input.enrolledUsers
		.map((u) => {
			const agg = perStudentAgg.get(u.id) ?? emptyAggregate();
			const attempted = perStudentExercises.get(u.id)?.size ?? 0;
			const passed = perStudentPassedExercises.get(u.id)?.size ?? 0;
			const attempts = agg.attempts;
			const round = (sum: number) => (attempts > 0 ? Math.round(sum / attempts) : 0);
			return {
				userId: u.id,
				name: u.name ?? u.email,
				email: u.email,
				attempts,
				exercisesAttempted: attempted,
				exercisesPassed: passed,
				passRate: attempts > 0 ? Math.round((agg.totalPassed / attempts) * 100) : 0,
				avgScore: round(agg.totalScore),
				avgWorkspaceBlockCount: round(agg.totalWorkspaceBlockCount),
				avgGeneratedCodeLength: round(agg.totalGeneratedCodeLength),
				hintUsageCount: agg.hintUsageCount,
				avgDurationMs: round(agg.totalDurationMs),
				lastAttemptAt: agg.lastAttemptAt,
				localeCounts: agg.localeCounts
			};
		})
		.sort((a, b) => {
			if (b.attempts !== a.attempts) return b.attempts - a.attempts;
			return a.name.localeCompare(b.name);
		});

	return {
		classId: input.classId,
		className: input.className,
		description: input.description,
		archivedAt: input.archivedAt,
		enrolledStudents: input.enrolledUsers.length,
		courseCount: input.courseIds.length,
		exerciseCount: input.exerciseIds.length,
		totals: totalsFrom(classAgg, studentsWithAttempts.size, input.enrolledUsers.length),
		students
	};
}
