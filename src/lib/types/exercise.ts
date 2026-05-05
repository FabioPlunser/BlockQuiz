import type { Point, TargetPoint } from '$lib/canvas/types';
import {
	LOGIC_BLOCKS,
	LOOP_BLOCKS,
	MATH_BLOCKS,
	TEXT_BLOCKS,
	VARIABLE_BLOCKS
} from '$lib/blockly/presets';

export interface LocalizedString {
	de: string;
	en: string;
}

export interface ExerciseWorkedExample {
	description: LocalizedString;
	starterXml: string;
	explanation: LocalizedString;
}

export interface ExerciseContent {
	title: LocalizedString;
	description: LocalizedString;
	image?: string;
	workedExample?: ExerciseWorkedExample;
	/**
	 * @deprecated Transitional alias for older content rows.
	 */
	example?: ExerciseWorkedExample;
}

export const exerciseTypes = ['io', 'turtle', 'robot'] as const;
export const dbExerciseTypes = ['all', 'io', 'turtle', 'robot'] as const;
export type DBExerciseType = (typeof dbExerciseTypes)[number];
export type ExerciseType = (typeof exerciseTypes)[number];

// Transitional authoring modes kept for the existing CMS/editor surfaces.
export const exerciseModes = ['default', 'path', 'apple'] as const;
export type ExerciseMode = (typeof exerciseModes)[number];

export type HintTrigger = 'click' | 'time';

export interface ExerciseHint {
	id: string;
	text: LocalizedString;
	trigger: HintTrigger;
	delaySeconds?: number;
}

export type PublishValidationSeverity = 'error' | 'warning';

export interface PublishValidationIssue {
	code: string;
	severity: PublishValidationSeverity;
	field: string;
	message: string;
}

export interface PublishValidationResult {
	valid: boolean;
	issues: PublishValidationIssue[];
	validatedAt?: number;
}

export interface IoNormalization {
	trim: boolean;
	collapseWhitespace: boolean;
	caseInsensitive: boolean;
	normalizeLineEndings: boolean;
	decimalSeparator?: '.' | ',' | 'either';
}

export interface IoTestCase {
	id: string;
	description: LocalizedString;
	visible: boolean;
	stdin: string;
	expectedStdout: string;
	message?: LocalizedString;
	seed?: string | number;
}

export interface IoExerciseConfig {
	mode: 'stdin-stdout';
	tests: IoTestCase[];
	normalization: IoNormalization;
	visibleExampleInput?: string;
	visibleExampleOutput?: string;
}

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

export interface TestCaseCollect {
	count: number;
}

export type TurtleTestCaseType = 'target' | 'commands' | 'state' | 'path';
export type RobotTestCaseType = TurtleTestCaseType | 'collect';
export type TestCaseType = TurtleTestCaseType;

interface BaseVisualTestCase<TType extends TurtleTestCaseType | RobotTestCaseType> {
	id: string;
	description: LocalizedString;
	visible: boolean;
	type: TType;
	message?: LocalizedString;
	expected: {
		target?: TestCaseTarget;
		commands?: string[];
		state?: TestCaseState;
		path?: Point[];
		collect?: TestCaseCollect;
	};
}

export type TurtleTestCase = BaseVisualTestCase<TurtleTestCaseType>;
export type RobotTestCase = BaseVisualTestCase<RobotTestCaseType>;
export type TestCase = TurtleTestCase | RobotTestCase;

export interface TurtleCanvasConfig {
	width: number;
	height: number;
	gridSize: number;
	pathOverlay: Point[];
	targets: TargetPoint[];
	walls: Point[];
}

export type CanvasConfig = TurtleCanvasConfig;

export interface TurtleGraderConfig {
	testCases: TurtleTestCase[];
	appleTolerance: number;
	wallTolerance: number;
}

export interface RobotGridConfig {
	width: number;
	height: number;
	cellSize: number;
	start: Point;
	direction: 'north' | 'east' | 'south' | 'west';
	walls: Point[];
	targets: Point[];
	collectibles?: Point[];
}

export interface RobotGraderConfig {
	testCases: RobotTestCase[];
	appleTolerance: number;
	wallTolerance: number;
}

export interface ExerciseCompatConfig {
	toolbox: string[];
	starterXml: string;
	hasStarterBlocks: boolean;
	hints: ExerciseHint[];
	mode: ExerciseMode;
	canvas: TurtleCanvasConfig;
	grader: {
		testCases: TestCase[];
		appleTolerance: number;
		wallTolerance: number;
	};
	grid: RobotGridConfig;
	io: IoExerciseConfig;
}

export interface ExerciseBase {
	id: string;
	courseId: string;
	type: ExerciseType;
	content: ExerciseContent;
	toolbox: string[];
	starterXml: string;
	hasStarterBlocks: boolean;
	hints: ExerciseHint[];
	published: boolean;
	order: number;
	validation: PublishValidationResult;
	createdBy: string;
	createdAt: number;
	updatedAt: number;
	archivedAt?: number | null;
	archivedBy?: string | null;
	config: ExerciseCompatConfig;
}

export interface IoExercise extends ExerciseBase {
	type: 'io';
	io: IoExerciseConfig;
	config: ExerciseCompatConfig;
}

export interface TurtleExercise extends ExerciseBase {
	type: 'turtle';
	canvas: TurtleCanvasConfig;
	grader: TurtleGraderConfig;
	config: ExerciseCompatConfig;
}

export interface RobotExercise extends ExerciseBase {
	type: 'robot';
	grid: RobotGridConfig;
	grader: RobotGraderConfig;
	config: ExerciseCompatConfig;
}

export type Exercise = IoExercise | TurtleExercise | RobotExercise;
export interface ExerciseFormData {
	id?: string;
	courseId: string;
	type: ExerciseType;
	content: ExerciseContent;
	config: ExerciseCompatConfig;
	published: boolean;
	order: number;
}

export type ExerciseListItem = ExerciseFormData & { id: string };

export type StoredExerciseConfig = ExerciseCompatConfig;

const EMPTY_POINT: Point = { x: 0, y: 0 };

const ALLOWED_TOOLBOX_BLOCKS = new Set([
	...LOGIC_BLOCKS,
	...LOOP_BLOCKS,
	...MATH_BLOCKS,
	...TEXT_BLOCKS,
	...VARIABLE_BLOCKS,
	'move',
	'turn',
	'pen',
	'color',
	'collect',
	'step',
	'turn_left',
	'turn_right'
]);

export const DEFAULT_LOCALIZED_STRING: LocalizedString = {
	de: '',
	en: ''
};

export const DEFAULT_PUBLISH_VALIDATION: PublishValidationResult = {
	valid: false,
	issues: []
};

export const DEFAULT_IO_NORMALIZATION: IoNormalization = {
	trim: true,
	collapseWhitespace: false,
	caseInsensitive: false,
	normalizeLineEndings: true,
	decimalSeparator: '.'
};

export const DEFAULT_TURTLE_CANVAS_CONFIG: TurtleCanvasConfig = {
	width: 400,
	height: 400,
	gridSize: 50,
	pathOverlay: [],
	targets: [],
	walls: []
};

export const DEFAULT_TURTLE_GRADER_CONFIG: TurtleGraderConfig = {
	appleTolerance: 0.5,
	wallTolerance: 0,
	testCases: []
};

export const DEFAULT_ROBOT_GRID_CONFIG: RobotGridConfig = {
	width: 8,
	height: 8,
	cellSize: 50,
	start: { ...EMPTY_POINT },
	direction: 'north',
	walls: [],
	targets: [],
	collectibles: []
};

export const DEFAULT_ROBOT_GRADER_CONFIG: RobotGraderConfig = {
	testCases: [],
	appleTolerance: 0,
	wallTolerance: 0
};

export const DEFAULT_IO_CONFIG: IoExerciseConfig = {
	mode: 'stdin-stdout',
	tests: [],
	normalization: { ...DEFAULT_IO_NORMALIZATION },
	visibleExampleInput: '',
	visibleExampleOutput: ''
};

export const DEFAULT_EXERCISE_CONTENT: ExerciseContent = {
	title: { ...DEFAULT_LOCALIZED_STRING },
	description: { ...DEFAULT_LOCALIZED_STRING },
	image: ''
};

function clone<T>(value: T): T {
	return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function normalizeString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function normalizeNumber(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((entry): entry is string => typeof entry === 'string');
}

function normalizePoint(value: unknown, fallback: Point = EMPTY_POINT): Point {
	if (!isRecord(value)) {
		return { ...fallback };
	}

	return {
		x: normalizeNumber(value.x, fallback.x),
		y: normalizeNumber(value.y, fallback.y)
	};
}

function normalizeTargetPoint(value: unknown): TargetPoint {
	const point = normalizePoint(value);
	const record = isRecord(value) ? value : {};
	return {
		...point,
		tolerance:
			typeof record.tolerance === 'number' && Number.isFinite(record.tolerance)
				? record.tolerance
				: undefined,
		icon:
			record.icon === 'apple' ||
			record.icon === 'flag' ||
			record.icon === 'star' ||
			record.icon === 'custom'
				? record.icon
				: undefined
	};
}

function normalizeLocalizedString(value: unknown): LocalizedString {
	if (!isRecord(value)) {
		return { ...DEFAULT_LOCALIZED_STRING };
	}

	return {
		de: normalizeString(value.de),
		en: normalizeString(value.en)
	};
}

function normalizeWorkedExample(value: unknown): ExerciseWorkedExample | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	return {
		description: normalizeLocalizedString(value.description),
		starterXml: normalizeString(value.starterXml),
		explanation: normalizeLocalizedString(value.explanation)
	};
}

export function normalizeExerciseContent(
	value: unknown,
	fallbackImage?: string | null | undefined
): ExerciseContent {
	const record = isRecord(value) ? value : {};
	const workedExample = normalizeWorkedExample(record.workedExample ?? record.example);

	return {
		title: normalizeLocalizedString(record.title),
		description: normalizeLocalizedString(record.description),
		image: normalizeString(record.image, normalizeString(fallbackImage)),
		workedExample
	};
}

export function normalizeExerciseHint(value: unknown): ExerciseHint {
	const record = isRecord(value) ? value : {};
	const trigger = record.trigger === 'time' ? 'time' : 'click';

	return {
		id: normalizeString(record.id, crypto.randomUUID()),
		text: normalizeLocalizedString(record.text),
		trigger,
		delaySeconds:
			trigger === 'time' && typeof record.delaySeconds === 'number'
				? record.delaySeconds
				: undefined
	};
}

function normalizeExerciseHints(value: unknown): ExerciseHint[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((hint) => normalizeExerciseHint(hint));
}

function normalizeValidationIssue(value: unknown): PublishValidationIssue | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const severity = value.severity === 'warning' ? 'warning' : 'error';

	return {
		code: normalizeString(value.code, 'unknown'),
		severity,
		field: normalizeString(value.field),
		message: normalizeString(value.message)
	};
}

export function normalizePublishValidation(value: unknown): PublishValidationResult {
	if (!isRecord(value)) {
		return clone(DEFAULT_PUBLISH_VALIDATION);
	}

	const issues = Array.isArray(value.issues)
		? value.issues
				.map((issue) => normalizeValidationIssue(issue))
				.filter((issue): issue is PublishValidationIssue => Boolean(issue))
		: [];

	return {
		valid:
			typeof value.valid === 'boolean'
				? value.valid
				: issues.every((issue) => issue.severity !== 'error'),
		issues,
		validatedAt: typeof value.validatedAt === 'number' ? value.validatedAt : undefined
	};
}

function normalizeIoNormalization(value: unknown): IoNormalization {
	const record = isRecord(value) ? value : {};
	return {
		trim: normalizeBoolean(record.trim, DEFAULT_IO_NORMALIZATION.trim),
		collapseWhitespace: normalizeBoolean(
			record.collapseWhitespace,
			DEFAULT_IO_NORMALIZATION.collapseWhitespace
		),
		caseInsensitive: normalizeBoolean(
			record.caseInsensitive,
			DEFAULT_IO_NORMALIZATION.caseInsensitive
		),
		normalizeLineEndings: normalizeBoolean(
			record.normalizeLineEndings,
			DEFAULT_IO_NORMALIZATION.normalizeLineEndings
		),
		decimalSeparator:
			record.decimalSeparator === ',' || record.decimalSeparator === 'either'
				? record.decimalSeparator
				: '.'
	};
}

export function normalizeIoTestCase(value: unknown): IoTestCase {
	const record = isRecord(value) ? value : {};
	return {
		id: normalizeString(record.id, crypto.randomUUID()),
		description: normalizeLocalizedString(record.description),
		visible: normalizeBoolean(record.visible, true),
		stdin: normalizeString(record.stdin),
		expectedStdout: normalizeString(record.expectedStdout),
		message: isRecord(record.message) ? normalizeLocalizedString(record.message) : undefined,
		seed:
			typeof record.seed === 'string' || typeof record.seed === 'number' ? record.seed : undefined
	};
}

function normalizeIoConfig(value: unknown): IoExerciseConfig {
	const record = isRecord(value) ? value : {};
	const tests = Array.isArray(record.tests)
		? record.tests.map((test) => normalizeIoTestCase(test))
		: [];

	return {
		mode: 'stdin-stdout',
		tests,
		normalization: normalizeIoNormalization(record.normalization),
		visibleExampleInput: normalizeString(record.visibleExampleInput),
		visibleExampleOutput: normalizeString(record.visibleExampleOutput)
	};
}

function normalizeTestCaseTarget(value: unknown): TestCaseTarget | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	return {
		x: normalizeNumber(value.x),
		y: normalizeNumber(value.y),
		tolerance: typeof value.tolerance === 'number' ? value.tolerance : undefined
	};
}

function normalizeTestCaseState(value: unknown): TestCaseState | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	return {
		x: normalizeNumber(value.x),
		y: normalizeNumber(value.y),
		angle: normalizeNumber(value.angle),
		tolerance: normalizeNumber(value.tolerance)
	};
}

function normalizeTestCaseCollect(value: unknown): TestCaseCollect | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	return {
		count: normalizeNumber(value.count)
	};
}

function normalizeVisualExpected(value: unknown) {
	const record = isRecord(value) ? value : {};

	return {
		target: normalizeTestCaseTarget(record.target),
		commands: normalizeStringArray(record.commands),
		state: normalizeTestCaseState(record.state),
		path: Array.isArray(record.path)
			? record.path.map((point) => normalizePoint(point))
			: undefined,
		collect: normalizeTestCaseCollect(record.collect)
	};
}

function normalizeVisualTestCaseType(
	type: unknown,
	fallback: TurtleTestCaseType | RobotTestCaseType
): TurtleTestCaseType | RobotTestCaseType {
	return type === 'target' ||
		type === 'commands' ||
		type === 'state' ||
		type === 'path' ||
		type === 'collect'
		? type
		: fallback;
}

export function normalizeVisualTestCase(
	value: unknown,
	kind: 'turtle' | 'robot'
): TurtleTestCase | RobotTestCase {
	const record = isRecord(value) ? value : {};
	const fallbackType: TurtleTestCaseType | RobotTestCaseType = 'target';
	const type = normalizeVisualTestCaseType(record.type, fallbackType);

	if (kind === 'turtle' && type === 'collect') {
		return {
			id: normalizeString(record.id, crypto.randomUUID()),
			description: normalizeLocalizedString(record.description),
			visible: normalizeBoolean(record.visible, true),
			type: 'target',
			message: isRecord(record.message) ? normalizeLocalizedString(record.message) : undefined,
			expected: normalizeVisualExpected(record.expected)
		};
	}

	return {
		id: normalizeString(record.id, crypto.randomUUID()),
		description: normalizeLocalizedString(record.description),
		visible: normalizeBoolean(record.visible, true),
		type: type as TurtleTestCaseType | RobotTestCaseType,
		message: isRecord(record.message) ? normalizeLocalizedString(record.message) : undefined,
		expected: normalizeVisualExpected(record.expected)
	};
}

function normalizeTurtleCanvas(value: unknown): TurtleCanvasConfig {
	const record = isRecord(value) ? value : {};

	return {
		width: normalizeNumber(record.width, DEFAULT_TURTLE_CANVAS_CONFIG.width),
		height: normalizeNumber(record.height, DEFAULT_TURTLE_CANVAS_CONFIG.height),
		gridSize: normalizeNumber(record.gridSize, DEFAULT_TURTLE_CANVAS_CONFIG.gridSize),
		pathOverlay: Array.isArray(record.pathOverlay)
			? record.pathOverlay.map((point) => normalizePoint(point))
			: [],
		targets: Array.isArray(record.targets)
			? record.targets.map((target) => normalizeTargetPoint(target))
			: [],
		walls: Array.isArray(record.walls) ? record.walls.map((wall) => normalizePoint(wall)) : []
	};
}

function normalizeTurtleGrader(value: unknown): TurtleGraderConfig {
	const record = isRecord(value) ? value : {};
	return {
		appleTolerance: normalizeNumber(
			record.appleTolerance,
			DEFAULT_TURTLE_GRADER_CONFIG.appleTolerance
		),
		wallTolerance: normalizeNumber(
			record.wallTolerance,
			DEFAULT_TURTLE_GRADER_CONFIG.wallTolerance
		),
		testCases: Array.isArray(record.testCases)
			? record.testCases.map((test) => normalizeVisualTestCase(test, 'turtle') as TurtleTestCase)
			: []
	};
}

function deriveRobotGridFromCanvas(
	canvas: TurtleCanvasConfig,
	source: Record<string, unknown>
): RobotGridConfig {
	return {
		width: Math.max(1, Math.round(canvas.width / Math.max(canvas.gridSize, 1))),
		height: Math.max(1, Math.round(canvas.height / Math.max(canvas.gridSize, 1))),
		cellSize: canvas.gridSize,
		start: normalizePoint(source.start, EMPTY_POINT),
		direction:
			source.direction === 'east' ||
			source.direction === 'south' ||
			source.direction === 'west' ||
			source.direction === 'north'
				? source.direction
				: 'north',
		walls: canvas.walls.map((wall) => normalizePoint(wall)),
		targets: canvas.targets.map((target) => normalizePoint(target)),
		collectibles: Array.isArray(source.collectibles)
			? source.collectibles.map((collectible) => normalizePoint(collectible))
			: []
	};
}

function normalizeRobotGrid(value: unknown, fallbackCanvas?: TurtleCanvasConfig): RobotGridConfig {
	const record = isRecord(value) ? value : {};
	if (!value && fallbackCanvas) {
		return deriveRobotGridFromCanvas(fallbackCanvas, record);
	}

	if (!isRecord(value) && fallbackCanvas) {
		return deriveRobotGridFromCanvas(fallbackCanvas, record);
	}

	return {
		width: normalizeNumber(record.width, DEFAULT_ROBOT_GRID_CONFIG.width),
		height: normalizeNumber(record.height, DEFAULT_ROBOT_GRID_CONFIG.height),
		cellSize: normalizeNumber(record.cellSize, DEFAULT_ROBOT_GRID_CONFIG.cellSize),
		start: normalizePoint(record.start, DEFAULT_ROBOT_GRID_CONFIG.start),
		direction:
			record.direction === 'east' ||
			record.direction === 'south' ||
			record.direction === 'west' ||
			record.direction === 'north'
				? record.direction
				: DEFAULT_ROBOT_GRID_CONFIG.direction,
		walls: Array.isArray(record.walls) ? record.walls.map((wall) => normalizePoint(wall)) : [],
		targets: Array.isArray(record.targets)
			? record.targets.map((target) => normalizePoint(target))
			: [],
		collectibles: Array.isArray(record.collectibles)
			? record.collectibles.map((collectible) => normalizePoint(collectible))
			: []
	};
}

function normalizeRobotGrader(value: unknown): RobotGraderConfig {
	const record = isRecord(value) ? value : {};
	return {
		testCases: Array.isArray(record.testCases)
			? record.testCases.map((test) => normalizeVisualTestCase(test, 'robot') as RobotTestCase)
			: [],
		appleTolerance: normalizeNumber(
			record.appleTolerance,
			DEFAULT_ROBOT_GRADER_CONFIG.appleTolerance
		),
		wallTolerance: normalizeNumber(record.wallTolerance, DEFAULT_ROBOT_GRADER_CONFIG.wallTolerance)
	};
}

function robotGridToCanvas(grid: RobotGridConfig): TurtleCanvasConfig {
	return {
		width: grid.width * grid.cellSize,
		height: grid.height * grid.cellSize,
		gridSize: grid.cellSize,
		pathOverlay: [],
		targets: grid.targets.map((target) => ({ ...target })),
		walls: grid.walls.map((wall) => ({ ...wall }))
	};
}

function createCompatConfig(
	toolbox: string[],
	starterXml: string,
	hasStarterBlocks: boolean,
	hints: ExerciseHint[],
	canvas: TurtleCanvasConfig,
	grid: RobotGridConfig,
	grader: TurtleGraderConfig | RobotGraderConfig,
	io: IoExerciseConfig,
	mode: ExerciseMode
): ExerciseCompatConfig {
	return {
		toolbox: clone(toolbox),
		starterXml,
		hasStarterBlocks,
		hints: clone(hints),
		mode,
		canvas: clone(canvas),
		grid: clone(grid),
		grader: {
			testCases: clone(grader.testCases) as TestCase[],
			appleTolerance: grader.appleTolerance,
			wallTolerance: grader.wallTolerance
		},
		io: clone(io)
	};
}

function buildStoredConfig(exercise: Exercise): StoredExerciseConfig {
	return clone(exercise.config);
}

function createValidationIssue(
	code: string,
	field: string,
	message: string,
	severity: PublishValidationSeverity = 'error'
): PublishValidationIssue {
	return { code, field, message, severity };
}

function isXmlLikelyParseable(xml: string): boolean {
	const trimmed = xml.trim();
	if (trimmed.length === 0) {
		return true;
	}

	if (!trimmed.startsWith('<xml') || !trimmed.endsWith('</xml>')) {
		return false;
	}

	if (typeof DOMParser === 'function') {
		const document = new DOMParser().parseFromString(trimmed, 'text/xml');
		return document.documentElement.nodeName === 'xml' && !document.querySelector('parsererror');
	}

	return true;
}

function collectStarterBlockTypes(xml: string): string[] {
	const blockTypes = new Set<string>();
	const blockTypePattern = /<(?:block|shadow)\b[^>]*\btype=["']([^"']+)["']/g;
	let match: RegExpExecArray | null;

	while ((match = blockTypePattern.exec(xml))) {
		blockTypes.add(match[1]);
	}

	return [...blockTypes];
}

function normalizeStarterBlockType(blockType: string, exerciseType: ExerciseType) {
	const prefix = `${exerciseType}_`;
	return blockType.startsWith(prefix) ? blockType.slice(prefix.length) : blockType;
}

function validateLocalizedField(
	value: LocalizedString,
	field: string,
	label: string,
	issues: PublishValidationIssue[]
) {
	if (!value.de.trim()) {
		issues.push(
			createValidationIssue(`${field}.de.missing`, `${field}.de`, `${label} (DE) is required.`)
		);
	}
	if (!value.en.trim()) {
		issues.push(
			createValidationIssue(`${field}.en.missing`, `${field}.en`, `${label} (EN) is required.`)
		);
	}
}

function collectExerciseTests(exercise: Exercise): Array<IoTestCase | TestCase> {
	if (exercise.type === 'io') {
		return exercise.io.tests;
	}

	return exercise.grader.testCases;
}

export function validateExercise(exercise: Exercise): PublishValidationResult {
	const issues: PublishValidationIssue[] = [];

	validateLocalizedField(exercise.content.title, 'content.title', 'Title', issues);
	validateLocalizedField(
		exercise.content.description,
		'content.description',
		'Description',
		issues
	);

	if (exercise.toolbox.some((block) => !block.trim())) {
		issues.push(
			createValidationIssue(
				'toolbox.invalid',
				'toolbox',
				'Toolbox contains an empty or invalid block id.'
			)
		);
	}

	const unknownToolboxBlock = exercise.toolbox.find((block) => !ALLOWED_TOOLBOX_BLOCKS.has(block));
	if (unknownToolboxBlock) {
		issues.push(
			createValidationIssue(
				'toolbox.unknownBlock',
				'toolbox',
				`Toolbox contains an unknown block id: ${unknownToolboxBlock}.`
			)
		);
	}

	if (!isXmlLikelyParseable(exercise.starterXml)) {
		issues.push(
			createValidationIssue(
				'starterXml.invalid',
				'starterXml',
				'Starter XML must be empty or a parseable Blockly <xml> document.'
			)
		);
	}

	if (exercise.starterXml.trim()) {
		for (const blockType of collectStarterBlockTypes(exercise.starterXml)) {
			const normalizedBlockType = normalizeStarterBlockType(blockType, exercise.type);
			if (!ALLOWED_TOOLBOX_BLOCKS.has(normalizedBlockType)) {
				issues.push(
					createValidationIssue(
						'starterXml.unknownBlock',
						'starterXml',
						`Starter XML contains an unknown block id: ${blockType}.`
					)
				);
				continue;
			}

			if (!exercise.toolbox.includes(normalizedBlockType)) {
				issues.push(
					createValidationIssue(
						'starterXml.blockOutsideToolbox',
						'starterXml',
						`Starter XML uses a block that is not available in the toolbox: ${blockType}.`
					)
				);
			}
		}
	}

	const tests = collectExerciseTests(exercise);
	if (tests.length === 0) {
		issues.push(
			createValidationIssue('tests.missing', 'tests', 'At least one test case is required.')
		);
	}
	if (tests.length > 0 && !tests.some((test) => !test.visible)) {
		issues.push(
			createValidationIssue(
				'tests.hiddenMissing',
				'tests',
				'At least one hidden test case is required.'
			)
		);
	}

	if (exercise.type === 'io') {
		if (exercise.io.mode !== 'stdin-stdout') {
			issues.push(
				createValidationIssue('io.mode.invalid', 'io.mode', 'Only stdin-stdout mode is supported.')
			);
		}
	} else if (exercise.type === 'turtle') {
		if (
			exercise.canvas.width <= 0 ||
			exercise.canvas.height <= 0 ||
			exercise.canvas.gridSize <= 0
		) {
			issues.push(
				createValidationIssue(
					'canvas.invalid',
					'canvas',
					'Canvas width, height, and grid size must all be greater than zero.'
				)
			);
		}
	} else {
		if (exercise.grid.width <= 0 || exercise.grid.height <= 0 || exercise.grid.cellSize <= 0) {
			issues.push(
				createValidationIssue(
					'grid.invalid',
					'grid',
					'Grid width, height, and cell size must all be greater than zero.'
				)
			);
		}
	}

	return {
		valid: issues.every((issue) => issue.severity !== 'error'),
		issues,
		validatedAt: Date.now()
	};
}

type ExerciseInput = Record<string, unknown> & {
	id?: string;
	courseId?: string;
	type?: ExerciseType;
	content?: unknown;
	config?: unknown;
	toolbox?: unknown;
	starterXml?: unknown;
	hasStarterBlocks?: unknown;
	hints?: unknown;
	canvas?: unknown;
	grid?: unknown;
	grader?: unknown;
	io?: unknown;
	published?: unknown;
	order?: unknown;
	createdBy?: unknown;
	createdAt?: unknown;
	updatedAt?: unknown;
	archivedAt?: unknown;
	archivedBy?: unknown;
	validation?: unknown;
	validationJson?: unknown;
	image?: string | null;
};

export function canonicalizeExercise(input: ExerciseInput): Exercise {
	const type: ExerciseType = input.type === 'io' || input.type === 'robot' ? input.type : 'turtle';
	const configRecord: Record<string, unknown> = isRecord(input.config) ? input.config : {};
	const toolbox = normalizeStringArray(input.toolbox ?? configRecord.toolbox);
	const starterXml = normalizeString(input.starterXml ?? configRecord.starterXml);
	const hasStarterBlocks = normalizeBoolean(
		input.hasStarterBlocks ?? configRecord.hasStarterBlocks,
		starterXml.trim().length > 0
	);
	const hints = normalizeExerciseHints(input.hints ?? configRecord.hints);
	const mode =
		configRecord.mode === 'path' || configRecord.mode === 'apple' || configRecord.mode === 'default'
			? configRecord.mode
			: 'default';

	const base = {
		id: normalizeString(input.id, crypto.randomUUID()),
		courseId: normalizeString(input.courseId),
		type,
		content: normalizeExerciseContent(input.content, input.image),
		toolbox,
		starterXml,
		hasStarterBlocks,
		hints,
		published: normalizeBoolean(input.published, false),
		order: normalizeNumber(input.order, 0),
		createdBy: normalizeString(input.createdBy),
		createdAt: normalizeNumber(input.createdAt, Date.now()),
		updatedAt: normalizeNumber(input.updatedAt, Date.now()),
		archivedAt: typeof input.archivedAt === 'number' ? input.archivedAt : null,
		archivedBy: typeof input.archivedBy === 'string' ? input.archivedBy : null
	} satisfies Omit<ExerciseBase, 'validation' | 'config'>;

	let exercise: Exercise;

	if (type === 'io') {
		const io = normalizeIoConfig(input.io ?? configRecord.io ?? configRecord);
		exercise = {
			...base,
			type: 'io',
			io,
			validation: clone(DEFAULT_PUBLISH_VALIDATION),
			config: createCompatConfig(
				toolbox,
				starterXml,
				hasStarterBlocks,
				hints,
				clone(DEFAULT_TURTLE_CANVAS_CONFIG),
				clone(DEFAULT_ROBOT_GRID_CONFIG),
				clone(DEFAULT_TURTLE_GRADER_CONFIG),
				io,
				mode
			)
		};
	} else if (type === 'robot') {
		const fallbackCanvas = normalizeTurtleCanvas(configRecord.canvas);
		const grid = normalizeRobotGrid(input.grid ?? configRecord.grid, fallbackCanvas);
		const grader = normalizeRobotGrader(input.grader ?? configRecord.grader);
		exercise = {
			...base,
			type: 'robot',
			grid,
			grader,
			validation: clone(DEFAULT_PUBLISH_VALIDATION),
			config: createCompatConfig(
				toolbox,
				starterXml,
				hasStarterBlocks,
				hints,
				robotGridToCanvas(grid),
				grid,
				grader,
				clone(DEFAULT_IO_CONFIG),
				mode
			)
		};
	} else {
		const canvas = normalizeTurtleCanvas(input.canvas ?? configRecord.canvas);
		const grader = normalizeTurtleGrader(input.grader ?? configRecord.grader);
		exercise = {
			...base,
			type: 'turtle',
			canvas,
			grader,
			validation: clone(DEFAULT_PUBLISH_VALIDATION),
			config: createCompatConfig(
				toolbox,
				starterXml,
				hasStarterBlocks,
				hints,
				canvas,
				deriveRobotGridFromCanvas(canvas, {}),
				grader,
				clone(DEFAULT_IO_CONFIG),
				mode
			)
		};
	}

	const storedValidation = normalizePublishValidation(input.validation ?? input.validationJson);
	const hasStoredValidation =
		isRecord(input.validation) ||
		isRecord(input.validationJson) ||
		storedValidation.issues.length > 0;
	const validation = hasStoredValidation ? storedValidation : validateExercise(exercise);

	return {
		...exercise,
		validation
	};
}

export function dehydrateExercise(exerciseInput: ExerciseInput): {
	exercise: Exercise;
	content: ExerciseContent;
	config: StoredExerciseConfig;
	validation: PublishValidationResult;
} {
	const exercise = canonicalizeExercise(exerciseInput);
	return {
		exercise,
		content: {
			title: clone(exercise.content.title),
			description: clone(exercise.content.description),
			image: exercise.content.image ?? '',
			workedExample: exercise.content.workedExample
				? clone(exercise.content.workedExample)
				: undefined
		},
		config: buildStoredConfig(exercise),
		validation: exercise.validation
	};
}

export function stripExerciseForLearners(exerciseInput: Exercise): Exercise {
	if (exerciseInput.type === 'io') {
		return canonicalizeExercise({
			...exerciseInput,
			io: {
				...exerciseInput.io,
				tests: exerciseInput.io.tests.filter((test) => test.visible)
			}
		});
	}

	return canonicalizeExercise({
		...exerciseInput,
		grader: {
			...exerciseInput.grader,
			testCases: exerciseInput.grader.testCases.filter((test) => test.visible)
		}
	});
}

export function createDefaultExercise(type: ExerciseType = 'turtle', courseId = ''): Exercise {
	const now = Date.now();

	if (type === 'io') {
		return canonicalizeExercise({
			id: crypto.randomUUID(),
			courseId,
			type,
			content: clone(DEFAULT_EXERCISE_CONTENT),
			toolbox: [],
			starterXml: '',
			hasStarterBlocks: false,
			hints: [],
			io: clone(DEFAULT_IO_CONFIG),
			published: false,
			order: 0,
			createdBy: '',
			createdAt: now,
			updatedAt: now,
			config: createCompatConfig(
				[],
				'',
				false,
				[],
				clone(DEFAULT_TURTLE_CANVAS_CONFIG),
				clone(DEFAULT_ROBOT_GRID_CONFIG),
				clone(DEFAULT_TURTLE_GRADER_CONFIG),
				clone(DEFAULT_IO_CONFIG),
				'default'
			)
		});
	}

	if (type === 'robot') {
		return canonicalizeExercise({
			id: crypto.randomUUID(),
			courseId,
			type,
			content: clone(DEFAULT_EXERCISE_CONTENT),
			toolbox: [],
			starterXml: '',
			hasStarterBlocks: false,
			hints: [],
			grid: clone(DEFAULT_ROBOT_GRID_CONFIG),
			grader: clone(DEFAULT_ROBOT_GRADER_CONFIG),
			published: false,
			order: 0,
			createdBy: '',
			createdAt: now,
			updatedAt: now,
			config: createCompatConfig(
				[],
				'',
				false,
				[],
				robotGridToCanvas(clone(DEFAULT_ROBOT_GRID_CONFIG)),
				clone(DEFAULT_ROBOT_GRID_CONFIG),
				clone(DEFAULT_ROBOT_GRADER_CONFIG),
				clone(DEFAULT_IO_CONFIG),
				'default'
			)
		});
	}

	return canonicalizeExercise({
		id: crypto.randomUUID(),
		courseId,
		type: 'turtle',
		content: clone(DEFAULT_EXERCISE_CONTENT),
		toolbox: [],
		starterXml: '',
		hasStarterBlocks: false,
		hints: [],
		canvas: clone(DEFAULT_TURTLE_CANVAS_CONFIG),
		grader: clone(DEFAULT_TURTLE_GRADER_CONFIG),
		published: false,
		order: 0,
		createdBy: '',
		createdAt: now,
		updatedAt: now,
		config: createCompatConfig(
			[],
			'',
			false,
			[],
			clone(DEFAULT_TURTLE_CANVAS_CONFIG),
			deriveRobotGridFromCanvas(clone(DEFAULT_TURTLE_CANVAS_CONFIG), {}),
			clone(DEFAULT_TURTLE_GRADER_CONFIG),
			clone(DEFAULT_IO_CONFIG),
			'default'
		)
	});
}

export function createDefaultExerciseFormData(courseId = ''): ExerciseFormData {
	const exercise = createDefaultExercise('turtle', courseId);
	return {
		id: exercise.id,
		courseId: exercise.courseId,
		type: exercise.type,
		content: exercise.content,
		config: exercise.config,
		published: exercise.published,
		order: exercise.order
	};
}

export function createHint(): ExerciseHint {
	return {
		id: crypto.randomUUID(),
		text: { ...DEFAULT_LOCALIZED_STRING },
		trigger: 'click'
	};
}

export function createTestCase(type: TurtleTestCaseType = 'target'): TurtleTestCase {
	return {
		id: crypto.randomUUID(),
		description: { ...DEFAULT_LOCALIZED_STRING },
		visible: true,
		type,
		message: { ...DEFAULT_LOCALIZED_STRING },
		expected: {}
	};
}

export function createIoTestCase(): IoTestCase {
	return {
		id: crypto.randomUUID(),
		description: { ...DEFAULT_LOCALIZED_STRING },
		visible: true,
		stdin: '',
		expectedStdout: '',
		message: { ...DEFAULT_LOCALIZED_STRING }
	};
}
