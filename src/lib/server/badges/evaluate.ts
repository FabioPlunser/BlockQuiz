import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db/client';
import { achievements, attempts, courseExercises } from '$lib/server/db/schema';
import {
	evaluateBadges,
	type AttemptSignal,
	type BadgeKey,
	type HistorySnapshot
} from '$lib/achievements/rules';

export async function evaluateAndPersistBadges(input: {
	userId: string;
	attemptSignal: AttemptSignal;
	relatedCourseIds: string[];
}): Promise<BadgeKey[]> {
	const earnedRows = await db
		.select({ badgeKey: achievements.badgeKey })
		.from(achievements)
		.where(eq(achievements.userId, input.userId));
	const earned = new Set<BadgeKey>(earnedRows.map((row) => row.badgeKey as BadgeKey));

	const userAttempts = await db
		.select({
			passed: attempts.passed,
			locale: attempts.locale,
			createdAt: attempts.createdAt
		})
		.from(attempts)
		.where(eq(attempts.userId, input.userId))
		.orderBy(desc(attempts.createdAt))
		.limit(50);

	let currentPassStreak = 0;
	for (const row of userAttempts) {
		if (row.passed) currentPassStreak += 1;
		else break;
	}

	const localesUsed = new Set<'de' | 'en'>();
	for (const row of userAttempts) {
		if (row.passed && (row.locale === 'de' || row.locale === 'en')) {
			localesUsed.add(row.locale);
		}
	}

	let completesCourse = false;
	if (input.attemptSignal.passed && input.relatedCourseIds.length > 0) {
		const passingExerciseIds = new Set(
			(
				await db
					.select({ exerciseId: attempts.exerciseId })
					.from(attempts)
					.where(and(eq(attempts.userId, input.userId), eq(attempts.passed, true)))
			).map((row) => row.exerciseId)
		);
		for (const courseId of input.relatedCourseIds) {
			const courseRows = await db
				.select({ exerciseId: courseExercises.exerciseId })
				.from(courseExercises)
				.where(eq(courseExercises.courseId, courseId));
			if (
				courseRows.length > 0 &&
				courseRows.every((row) => passingExerciseIds.has(row.exerciseId))
			) {
				completesCourse = true;
				break;
			}
		}
	}

	const history: HistorySnapshot = {
		earned,
		currentPassStreak,
		localesUsed,
		completesCourse
	};

	const awards = evaluateBadges(input.attemptSignal, history);
	if (awards.length === 0) return [];

	const now = Date.now();
	await db.insert(achievements).values(
		awards.map((award) => ({
			id: crypto.randomUUID(),
			userId: input.userId,
			badgeKey: award.badge,
			awardedAt: now,
			contextJson: JSON.stringify(award.context)
		}))
	);

	return awards.map((award) => award.badge);
}
