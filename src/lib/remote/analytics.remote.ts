import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query } from '$app/server';
import { requireTeacherOrAdmin } from '$lib/utils/requireAuth';
import {
	loadClassAnalytics,
	loadClassAttemptsExport,
	loadClassesAnalytics,
	loadStudentClassAnalytics
} from '$server/analytics/queries';

export const getClassesAnalytics = query(async () => {
	requireTeacherOrAdmin();
	return loadClassesAnalytics();
});

export const getClassAnalytics = query(z.object({ classId: z.string() }), async ({ classId }) => {
	requireTeacherOrAdmin();
	const result = await loadClassAnalytics(classId);
	if (!result) error(404, 'Class not found');
	return result;
});

export const getStudentClassAnalytics = query(
	z.object({ classId: z.string(), userId: z.string() }),
	async ({ classId, userId }) => {
		requireTeacherOrAdmin();
		const result = await loadStudentClassAnalytics(classId, userId);
		if (!result) error(404, 'Student or class not found');
		return result;
	}
);

export const exportClassAttempts = query(
	z.object({ classId: z.string() }),
	async ({ classId }) => {
		requireTeacherOrAdmin();
		return loadClassAttemptsExport(classId);
	}
);
