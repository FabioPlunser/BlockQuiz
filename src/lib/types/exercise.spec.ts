import { describe, expect, it } from 'vitest';
import {
	canonicalizeExercise,
	createDefaultExercise,
	dehydrateExercise,
	validateExercise
} from './exercise';

const content = {
	title: { de: 'Roboter-Labyrinth', en: 'Robot maze' },
	description: { de: 'Finde das Ziel.', en: 'Find the target.' },
	image: ''
};

const robotGrid = {
	width: 6,
	height: 4,
	cellSize: 40,
	start: { x: 40, y: 80 },
	direction: 'east' as const,
	targets: [{ x: 160, y: 80 }],
	walls: [{ x: 80, y: 80 }],
	collectibles: [{ x: 120, y: 80 }]
};

const staleCanvas = {
	width: 999,
	height: 999,
	gridSize: 99,
	pathOverlay: [],
	targets: [{ x: 999, y: 999, icon: 'apple' as const }],
	walls: [{ x: 888, y: 888 }]
};

function createRobotInput() {
	return {
		id: 'robot-exercise',
		courseId: 'course-1',
		type: 'robot' as const,
		content,
		config: {
			toolbox: [],
			starterXml: '',
			hasStarterBlocks: false,
			hints: [],
			mode: 'default',
			canvas: staleCanvas,
			grid: robotGrid,
			grader: {
				testCases: [],
				appleTolerance: 0,
				wallTolerance: 0
			}
		},
		published: false,
		order: 0,
		createdBy: 'teacher-1',
		createdAt: 1,
		updatedAt: 2
	};
}

describe('robot exercise config', () => {
	it('uses grid data as the source of truth over stale canvas data', () => {
		expect.assertions(8);

		const exercise = canonicalizeExercise(createRobotInput());

		expect(exercise.type).toBe('robot');
		if (exercise.type !== 'robot') return;

		expect(exercise.grid).toEqual(robotGrid);
		expect(exercise.config.grid).toEqual(robotGrid);
		expect(exercise.config.canvas.width).toBe(240);
		expect(exercise.config.canvas.height).toBe(160);
		expect(exercise.config.canvas.gridSize).toBe(40);
		expect(exercise.config.canvas.targets).toEqual([{ x: 160, y: 80 }]);
		expect(exercise.config.canvas.walls).toEqual([{ x: 80, y: 80 }]);
	});

	it('dehydrates robot configs with grid-derived canvas compatibility data', () => {
		expect.assertions(4);

		const persisted = dehydrateExercise(createRobotInput());

		expect(persisted.config.grid).toEqual(robotGrid);
		expect(persisted.config.canvas.width).toBe(240);
		expect(persisted.config.canvas.targets).toEqual([{ x: 160, y: 80 }]);
		expect(persisted.config.canvas.walls).toEqual([{ x: 80, y: 80 }]);
	});
});

describe('validateExercise', () => {
	it('rejects unknown toolbox block ids', () => {
		expect.assertions(2);

		const exercise = createDefaultExercise('io');
		exercise.content.title = { de: 'Titel', en: 'Title' };
		exercise.content.description = { de: 'Beschreibung', en: 'Description' };
		exercise.toolbox = ['text_print', 'unknown_block'];

		const validation = validateExercise(exercise);

		expect(validation.valid).toBe(false);
		expect(validation.issues.some((issue) => issue.code === 'toolbox.unknownBlock')).toBe(true);
	});

	it('rejects starter blocks that are outside the selected toolbox', () => {
		expect.assertions(2);

		const exercise = createDefaultExercise('turtle');
		exercise.content.title = { de: 'Titel', en: 'Title' };
		exercise.content.description = { de: 'Beschreibung', en: 'Description' };
		exercise.toolbox = ['move', 'math_number'];
		exercise.starterXml =
			'<xml xmlns="https://developers.google.com/blockly/xml"><block type="turtle_turn"></block></xml>';

		const validation = validateExercise(exercise);

		expect(validation.valid).toBe(false);
		expect(validation.issues.some((issue) => issue.code === 'starterXml.blockOutsideToolbox')).toBe(
			true
		);
	});

	it('rejects unknown starter block ids', () => {
		expect.assertions(2);

		const exercise = createDefaultExercise('io');
		exercise.content.title = { de: 'Titel', en: 'Title' };
		exercise.content.description = { de: 'Beschreibung', en: 'Description' };
		exercise.toolbox = ['text_print'];
		exercise.starterXml =
			'<xml xmlns="https://developers.google.com/blockly/xml"><block type="unknown_block"></block></xml>';

		const validation = validateExercise(exercise);

		expect(validation.valid).toBe(false);
		expect(validation.issues.some((issue) => issue.code === 'starterXml.unknownBlock')).toBe(true);
	});
});
