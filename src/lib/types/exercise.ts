import type { db } from '$db/client';
import type { Point, TargetPoint } from '$lib/canvas/types';

// =============================================================================
// Localized Content Types
// =============================================================================

export interface LocalizedString {
	de: string;
	en: string;
}

// =============================================================================
// Exercise Types & Modes
// =============================================================================

export const exerciseTypes = ['io', 'turtle', 'robot'] as const;
export const dbExerciseTypes = ['all', 'io', 'turtle', 'robot'] as const;
export type DBExerciseType = (typeof dbExerciseTypes)[number];
export type ExerciseType = (typeof exerciseTypes)[number];
export const exerciseModes = ['default', 'path', 'apple'] as const;
export type ExerciseMode = (typeof exerciseModes)[number];

// =============================================================================
// Hint Configuration
// =============================================================================

export type HintTrigger = 'click' | 'time';

export interface ExerciseHint {
	id: string;
	text: LocalizedString;
	trigger: HintTrigger;
	/** Delay in seconds before hint is shown (only for trigger: 'time') */
	delaySeconds?: number;
}

// =============================================================================
// Test Case Configuration
// =============================================================================

export type TestCaseType = 'target' | 'commands' | 'state' | 'path';

export interface TestCaseTarget {
	x: number;
	y: number;
	tolerance?: number;
}

export interface TestCaseState {
	x: number;
	y: number;
	angle: number;
	tolerance: number;
}

export interface TestCase {
	id: string;
	description: LocalizedString;
	visible: boolean;
	type: TestCaseType;
	message?: LocalizedString;
	expected: {
		target?: TestCaseTarget;
		commands?: string[];
		state?: TestCaseState;
		path?: Point[];
	};
}

// =============================================================================
// Canvas Configuration
// =============================================================================

export interface CanvasConfig {
	width: number;
	height: number;
	gridSize: number;
	pathOverlay: Point[];
	targets: TargetPoint[];
	walls: Point[];
}

// =============================================================================
// Grader Configuration
// =============================================================================

export interface GraderConfig {
	appleTolerance: number;
	wallTolerance: number;
	testCases: TestCase[];
}

// =============================================================================
// Exercise Configuration (stored as JSON in DB)
// =============================================================================

export interface ExerciseConfig {
	mode: ExerciseMode;
	toolbox: string[];
	starterXml: string;
	hasStarterBlocks: boolean;
	canvas: CanvasConfig;
	grader: GraderConfig;
	hints: ExerciseHint[];
}

// =============================================================================
// Exercise Content (stored as JSON in DB)
// =============================================================================

export interface ExerciseContent {
	title: LocalizedString;
	description: LocalizedString;
	image?: string;
	example?: {
		description: LocalizedString;
		starterXml: string;
		explanation: LocalizedString;
	};
}

// =============================================================================
// Full Exercise Model
// =============================================================================

export interface Exercise {
	id: string;
	courseId: string;
	type: ExerciseType;
	content: ExerciseContent;
	config: ExerciseConfig;
	published: boolean;
	order: number;
	createdBy: string;
	createdAt: number;
	updatedAt: number;
}

// =============================================================================
// Form/Editor State Types
// =============================================================================

export interface ExerciseFormData {
	courseId: string;
	type: ExerciseType;
	image?: string;
	content: ExerciseContent;
	config: ExerciseConfig;
	published: boolean;
	order: number;
}

export interface ExerciseListItem {
	id: string;
	courseId: string;
	type: ExerciseType;
	content: ExerciseContent;
	config: ExerciseConfig;
	published: boolean;
	order: number;
}

// =============================================================================
// Default Values
// =============================================================================

export const DEFAULT_LOCALIZED_STRING: LocalizedString = {
	de: '',
	en: ''
};

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
	width: 400,
	height: 400,
	gridSize: 50,
	pathOverlay: [],
	targets: [],
	walls: []
};

export const DEFAULT_GRADER_CONFIG: GraderConfig = {
	appleTolerance: 0.5,
	wallTolerance: 0,
	testCases: []
};

export const DEFAULT_EXERCISE_CONFIG: ExerciseConfig = {
	mode: 'default',
	toolbox: [],
	starterXml: '',
	hasStarterBlocks: false,
	canvas: DEFAULT_CANVAS_CONFIG,
	grader: DEFAULT_GRADER_CONFIG,
	hints: []
};

export const DEFAULT_EXERCISE_CONTENT: ExerciseContent = {
	title: { ...DEFAULT_LOCALIZED_STRING },
	description: { ...DEFAULT_LOCALIZED_STRING },
	image: ''
};

export function createDefaultExerciseFormData(courseId: string = ''): ExerciseFormData {
	return {
		courseId,
		type: 'turtle',
		content: structuredClone(DEFAULT_EXERCISE_CONTENT),
		config: structuredClone(DEFAULT_EXERCISE_CONFIG),
		published: false,
		order: 0
	};
}

export function createHint(): ExerciseHint {
	return {
		id: crypto.randomUUID(),
		text: { ...DEFAULT_LOCALIZED_STRING },
		trigger: 'click'
	};
}

export function createTestCase(): TestCase {
	return {
		id: crypto.randomUUID(),
		description: { ...DEFAULT_LOCALIZED_STRING },
		visible: true,
		type: 'target',
		message: { ...DEFAULT_LOCALIZED_STRING },
		expected: {}
	};
}
