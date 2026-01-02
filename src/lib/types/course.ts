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
	exerciseIds: string[];
	userIds: string[];
	published: boolean;
}

export interface CourseFormData {
	content: CourseContent;
	published: boolean;
	exerciseIds: string[];
	userIds: string[];
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
		exerciseIds: [],
		userIds: []
	};
}
