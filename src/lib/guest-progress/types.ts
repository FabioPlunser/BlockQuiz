import type { AttemptSnapshot } from '$lib/types/attempt';
import type { BadgeKey } from '$lib/achievements/rules';

export interface GuestBadgeRecord {
	badgeKey: BadgeKey;
	awardedAt: number;
}

export interface GuestExerciseProgress {
	exerciseId: string;
	bestScore: number;
	passed: boolean;
	attemptCount: number;
	lastAttemptId?: string;
	lastAttemptAt?: number;
}

export interface GuestCourseProgress {
	courseId: string;
	exerciseIds: string[];
	exerciseProgress: Record<string, GuestExerciseProgress>;
	completedCount: number;
	exerciseCount: number;
	progress: number;
	lastExerciseId?: string;
	lastExerciseIndex?: number;
	updatedAt: number;
}

export interface GuestAttemptSnapshot extends AttemptSnapshot {
	clientId: string;
	actorType: 'guest';
	userId?: never;
}

export interface GuestProgressExport {
	version: 1;
	clientId: string;
	exportedAt: number;
	courses: GuestCourseProgress[];
	attempts: GuestAttemptSnapshot[];
	badges?: GuestBadgeRecord[];
}

export interface GuestAttemptDraft {
	courseId: string;
	exerciseIds: string[];
	exerciseIndex: number;
	attempt: Omit<GuestAttemptSnapshot, 'id' | 'clientId' | 'actorType' | 'createdAt'> &
		Partial<Pick<GuestAttemptSnapshot, 'id' | 'createdAt'>>;
}
