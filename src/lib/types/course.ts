export interface LocalizedString {
	de: string;
	en: string;
}

export interface CourseContent {
	title: LocalizedString;
	description: LocalizedString;
	image: string;
}

export interface Course {
	id: string;
	content: CourseContent;
	createdAt: number;
	updatedAt: Date;
	createdBy: string;
	published: boolean;
	demo: boolean;
	archivedAt?: number | null;
	archivedBy?: string | null;
}

export interface UserCourse extends Course {
	numExercises: number;
	progress: number;
	completedCount: number;
}

/**
 * Course as returned to staff (teacher/admin) by getCourses / getCourse —
 * includes the assigned exercise, user, and class relations.
 */
export interface CourseWithRelations extends Course {
	exerciseIds: string[];
	userIds: string[];
	classIds: string[];
}

export interface CourseFormData {
	content: CourseContent;
	published: boolean;
	demo: boolean;
	exerciseIds: string[];
	userIds: string[];
	classIds: string[];
}

export function createDefaultCourseFormData(): CourseFormData {
	return {
		content: {
			title: {
				de: '',
				en: ''
			},
			description: {
				de: '',
				en: ''
			},
			image: ''
		},
		published: false,
		demo: false,
		exerciseIds: [],
		userIds: [],
		classIds: []
	};
}
