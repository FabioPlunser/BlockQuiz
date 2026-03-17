import { db } from '$lib/server/db/client';
import { courseExercises, courses, exercises, user } from '$lib/server/db/schema';
import { dehydrateExercise } from '$lib/types/exercise';

const teacherId = 'seed-teacher';
const now = Date.now();

// ─── Helper ────────────────────────────────────────────────────────────────────

async function seedExercise(input: Parameters<typeof dehydrateExercise>[0]) {
	const { exercise, content, config, validation } = dehydrateExercise(input);
	await db
		.insert(exercises)
		.values({
			id: exercise.id,
			courseId: exercise.courseId,
			type: exercise.type,
			image: exercise.content.image ?? '',
			content,
			config,
			validationJson: validation,
			published: exercise.published,
			order: exercise.order,
			createdBy: exercise.createdBy,
			createdAt: exercise.createdAt,
			updatedAt: exercise.updatedAt
		})
		.onConflictDoNothing();
	return exercise.id;
}

async function seedCourseExercises(courseId: string, exerciseIds: string[]) {
	for (const [index, exerciseId] of exerciseIds.entries()) {
		await db
			.insert(courseExercises)
			.values({
				id: `${courseId}--${exerciseId}`,
				courseId,
				exerciseId,
				order: index,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoNothing();
	}
}

// ─── Shared ────────────────────────────────────────────────────────────────────

const EMPTY_STARTER_XML = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>';

const IO_NORMALIZATION = {
	trim: true,
	collapseWhitespace: true,
	caseInsensitive: false,
	normalizeLineEndings: true,
	decimalSeparator: '.' as const
};

// ─── Teacher ───────────────────────────────────────────────────────────────────

await db
	.insert(user)
	.values({
		id: teacherId,
		name: 'Seed Teacher',
		email: 'seed-teacher@example.com',
		emailVerified: true,
		role: 'teacher',
		active: true,
		createdAt: new Date(now),
		updatedAt: new Date(now)
	})
	.onConflictDoNothing();

// ─── Courses ───────────────────────────────────────────────────────────────────

const mainCourseId = 'intro-programming';
const demoCourseId = 'demo-course';

await db
	.insert(courses)
	.values({
		id: mainCourseId,
		content: {
			title: { de: 'Einführung Programmieren', en: 'Intro to Programming' },
			description: {
				de: 'Grundlagenkurs mit Blockly-Aufgaben: Textausgabe, Turtle-Grafik und Robotersteuerung.',
				en: 'Foundations course with Blockly exercises: text output, turtle graphics, and robot control.'
			},
			image: ''
		},
		published: true,
		createdAt: now,
		updatedAt: new Date(now),
		createdBy: teacherId
	})
	.onConflictDoNothing();

await db
	.insert(courses)
	.values({
		id: demoCourseId,
		content: {
			title: { de: 'BlockQuiz Demo', en: 'BlockQuiz Demo' },
			description: {
				de: 'Probiere BlockQuiz aus! Drei kurze Aufgaben zum Kennenlernen – kein Login nötig.',
				en: 'Try BlockQuiz! Three short exercises to get started – no login required.'
			},
			image: ''
		},
		published: true,
		createdAt: now,
		updatedAt: new Date(now),
		createdBy: teacherId
	})
	.onConflictDoNothing();

// =============================================================================
// IO EXERCISES (4)
// =============================================================================

// ── IO 1: Even or Odd ──────────────────────────────────────────────────────────
const ioEvenOdd = await seedExercise({
	id: 'io-even-odd',
	courseId: mainCourseId,
	type: 'io',
	content: {
		title: { de: 'Gerade oder Ungerade', en: 'Even or Odd' },
		description: {
			de: 'Lies eine Zahl ein und gib "even" aus wenn sie gerade ist, sonst "odd".',
			en: 'Read a number and print "even" if it is even, otherwise print "odd".'
		},
		image: ''
	},
	config: {
		toolbox: [
			'text_print',
			'text',
			'math_number',
			'math_arithmetic',
			'controls_if',
			'logic_compare',
			'math_number_property'
		],
		starterXml: EMPTY_STARTER_XML,
		hasStarterBlocks: false,
		hints: [
			{
				id: 'even-odd-hint1',
				text: {
					de: 'Prüfe den Rest bei Division durch 2.',
					en: 'Check the remainder when dividing by 2.'
				},
				trigger: 'click'
			},
			{
				id: 'even-odd-hint2',
				text: {
					de: 'Nutze den "ist gerade" Block aus der Mathematik-Kategorie.',
					en: 'Use the "is even" block from the Math category.'
				},
				trigger: 'time',
				delaySeconds: 60
			}
		],
		io: {
			mode: 'stdin-stdout',
			normalization: IO_NORMALIZATION,
			visibleExampleInput: '4',
			visibleExampleOutput: 'even',
			tests: [
				{
					id: 'even-odd-v1',
					description: { de: 'Beispiel: 4 → even', en: 'Example: 4 → even' },
					visible: true,
					stdin: '4',
					expectedStdout: 'even'
				},
				{
					id: 'even-odd-v2',
					description: { de: 'Beispiel: 7 → odd', en: 'Example: 7 → odd' },
					visible: true,
					stdin: '7',
					expectedStdout: 'odd'
				},
				{
					id: 'even-odd-h1',
					description: { de: 'Versteckter Test', en: 'Hidden test' },
					visible: false,
					stdin: '0',
					expectedStdout: 'even'
				},
				{
					id: 'even-odd-h2',
					description: { de: 'Versteckter Test', en: 'Hidden test' },
					visible: false,
					stdin: '1',
					expectedStdout: 'odd'
				}
			]
		},
		mode: 'default'
	},
	published: true,
	order: 0,
	createdBy: teacherId,
	createdAt: now,
	updatedAt: now
});

// ── IO 2: Double It ─────────────────────────────────────────────────────────────
const ioDoubleIt = await seedExercise({
	id: 'io-double-it',
	courseId: mainCourseId,
	type: 'io',
	content: {
		title: { de: 'Verdopple es', en: 'Double It' },
		description: {
			de: 'Lies eine Zahl ein und gib das Doppelte aus.',
			en: 'Read a number and print double its value.'
		},
		image: ''
	},
	config: {
		toolbox: ['text_print', 'math_number', 'math_arithmetic'],
		starterXml: EMPTY_STARTER_XML,
		hasStarterBlocks: false,
		hints: [
			{
				id: 'double-hint1',
				text: {
					de: 'Multipliziere die eingelesene Zahl mit 2.',
					en: 'Multiply the input number by 2.'
				},
				trigger: 'click'
			}
		],
		io: {
			mode: 'stdin-stdout',
			normalization: IO_NORMALIZATION,
			visibleExampleInput: '5',
			visibleExampleOutput: '10',
			tests: [
				{
					id: 'double-v1',
					description: { de: 'Beispiel: 5 → 10', en: 'Example: 5 → 10' },
					visible: true,
					stdin: '5',
					expectedStdout: '10'
				},
				{
					id: 'double-h1',
					description: { de: 'Versteckter Test', en: 'Hidden test' },
					visible: false,
					stdin: '0',
					expectedStdout: '0'
				},
				{
					id: 'double-h2',
					description: { de: 'Versteckter Test', en: 'Hidden test' },
					visible: false,
					stdin: '123',
					expectedStdout: '246'
				}
			]
		},
		mode: 'default'
	},
	published: true,
	order: 1,
	createdBy: teacherId,
	createdAt: now,
	updatedAt: now
});

// ── IO 3: Sum 1 to N (existing, updated) ────────────────────────────────────────
const ioSum = await seedExercise({
	id: 'sum-1-to-n',
	courseId: mainCourseId,
	type: 'io',
	content: {
		title: { de: 'Summe 1 bis N', en: 'Sum 1 to N' },
		description: {
			de: 'Berechne die Summe der Zahlen von 1 bis N und gib sie aus.',
			en: 'Compute the sum of the numbers from 1 to N and print the result.'
		},
		image: ''
	},
	config: {
		toolbox: [
			'math_arithmetic',
			'controls_repeat_ext',
			'controls_for',
			'text_print',
			'math_number'
		],
		starterXml: EMPTY_STARTER_XML,
		hasStarterBlocks: false,
		hints: [
			{
				id: 'hint-loop',
				text: {
					de: 'Nutze eine Schleife und eine Summenvariable.',
					en: 'Use a loop and an accumulator variable.'
				},
				trigger: 'click'
			},
			{
				id: 'hint-range',
				text: {
					de: 'Starte bei 1 und addiere bis inklusive N.',
					en: 'Start at 1 and add up to and including N.'
				},
				trigger: 'click'
			}
		],
		io: {
			mode: 'stdin-stdout',
			normalization: IO_NORMALIZATION,
			visibleExampleInput: '3',
			visibleExampleOutput: '6',
			tests: [
				{
					id: 'sum-visible',
					description: { de: 'Beispiel mit N = 3', en: 'Example with N = 3' },
					visible: true,
					stdin: '3',
					expectedStdout: '6'
				},
				{
					id: 'sum-v2',
					description: { de: 'Beispiel mit N = 1', en: 'Example with N = 1' },
					visible: true,
					stdin: '1',
					expectedStdout: '1'
				},
				{
					id: 'sum-hidden',
					description: { de: 'Versteckter Test mit N = 5', en: 'Hidden test with N = 5' },
					visible: false,
					stdin: '5',
					expectedStdout: '15'
				},
				{
					id: 'sum-hidden2',
					description: { de: 'Versteckter Test mit N = 10', en: 'Hidden test with N = 10' },
					visible: false,
					stdin: '10',
					expectedStdout: '55'
				}
			]
		},
		mode: 'default'
	},
	published: true,
	order: 2,
	createdBy: teacherId,
	createdAt: now,
	updatedAt: now
});

// ── IO 4: Print Grid ────────────────────────────────────────────────────────────
const ioPrintGrid = await seedExercise({
	id: 'io-print-grid',
	courseId: mainCourseId,
	type: 'io',
	content: {
		title: { de: 'Zahlenreihe drucken', en: 'Print Number Row' },
		description: {
			de: 'Lies eine Zahl N und gib die Zahlen von 1 bis N in einer Zeile aus, getrennt durch Leerzeichen.',
			en: 'Read a number N and print the numbers from 1 to N on one line, separated by spaces.'
		},
		image: ''
	},
	config: {
		toolbox: [
			'text_print',
			'text',
			'text_join',
			'math_number',
			'math_arithmetic',
			'controls_for',
			'controls_repeat_ext'
		],
		starterXml: EMPTY_STARTER_XML,
		hasStarterBlocks: false,
		hints: [
			{
				id: 'grid-hint1',
				text: {
					de: 'Baue einen Text in einer Schleife zusammen und gib ihn am Ende aus.',
					en: 'Build a string inside a loop and print it at the end.'
				},
				trigger: 'click'
			},
			{
				id: 'grid-hint2',
				text: {
					de: 'Nutze "Text verbinden" um Zahlen und Leerzeichen zusammenzufügen.',
					en: 'Use "join text" to combine numbers and spaces.'
				},
				trigger: 'time',
				delaySeconds: 90
			}
		],
		io: {
			mode: 'stdin-stdout',
			normalization: { ...IO_NORMALIZATION, collapseWhitespace: false },
			visibleExampleInput: '5',
			visibleExampleOutput: '1 2 3 4 5',
			tests: [
				{
					id: 'grid-v1',
					description: { de: 'Beispiel: N = 5', en: 'Example: N = 5' },
					visible: true,
					stdin: '5',
					expectedStdout: '1 2 3 4 5'
				},
				{
					id: 'grid-h1',
					description: { de: 'Versteckter Test', en: 'Hidden test' },
					visible: false,
					stdin: '1',
					expectedStdout: '1'
				},
				{
					id: 'grid-h2',
					description: { de: 'Versteckter Test', en: 'Hidden test' },
					visible: false,
					stdin: '3',
					expectedStdout: '1 2 3'
				}
			]
		},
		mode: 'default'
	},
	published: true,
	order: 3,
	createdBy: teacherId,
	createdAt: now,
	updatedAt: now
});

// =============================================================================
// TURTLE EXERCISES (4)
// =============================================================================

// Canvas defaults: 400×400, gridSize 50 → center at (200, 200)
// move 1 = 50px in the current direction; initial angle = 0 (north/up)

// ── Turtle 1: Draw a Line ───────────────────────────────────────────────────────
const turtleLine = await seedExercise({
	id: 'turtle-draw-line',
	courseId: mainCourseId,
	type: 'turtle',
	content: {
		title: { de: 'Zeichne eine Linie', en: 'Draw a Line' },
		description: {
			de: 'Bewege die Schildkröte 3 Schritte nach oben.',
			en: 'Move the turtle 3 steps upward.'
		},
		image: ''
	},
	config: {
		toolbox: ['move', 'math_number'],
		starterXml: EMPTY_STARTER_XML,
		hasStarterBlocks: false,
		hints: [
			{
				id: 'line-hint1',
				text: {
					de: 'Nutze den "bewege" Block mit der Zahl 3.',
					en: 'Use the "move" block with the number 3.'
				},
				trigger: 'click'
			}
		],
		canvas: {
			width: 400,
			height: 400,
			gridSize: 50,
			pathOverlay: [],
			targets: [{ x: 200, y: 50 }],
			walls: []
		},
		grader: {
			appleTolerance: 25,
			wallTolerance: 0,
			testCases: [
				{
					id: 'line-target',
					description: { de: 'Ziel erreicht', en: 'Reached the target' },
					visible: true,
					type: 'target',
					expected: { target: { x: 200, y: 50, tolerance: 25 } }
				},
				{
					id: 'line-state',
					description: { de: 'Korrekte Endposition', en: 'Correct final position' },
					visible: false,
					type: 'state',
					expected: { state: { x: 200, y: 50, angle: 0, tolerance: 5 } }
				}
			]
		},
		mode: 'default'
	},
	published: true,
	order: 4,
	createdBy: teacherId,
	createdAt: now,
	updatedAt: now
});

// ── Turtle 2: Draw a Square ─────────────────────────────────────────────────────
const turtleSquare = await seedExercise({
	id: 'turtle-draw-square',
	courseId: mainCourseId,
	type: 'turtle',
	content: {
		title: { de: 'Zeichne ein Quadrat', en: 'Draw a Square' },
		description: {
			de: 'Zeichne ein Quadrat mit Seitenlänge 2 Schritte. Die Schildkröte soll am Startpunkt enden.',
			en: 'Draw a square with side length 2 steps. The turtle should end at the starting point.'
		},
		image: ''
	},
	config: {
		toolbox: ['move', 'turn', 'math_number', 'controls_repeat_ext'],
		starterXml: EMPTY_STARTER_XML,
		hasStarterBlocks: false,
		hints: [
			{
				id: 'square-hint1',
				text: {
					de: 'Wiederhole 4 mal: bewege 2 Schritte und drehe 90°.',
					en: 'Repeat 4 times: move 2 steps and turn 90°.'
				},
				trigger: 'click'
			},
			{
				id: 'square-hint2',
				text: {
					de: 'Nutze einen Wiederholungsblock, damit der Code kürzer wird.',
					en: 'Use a repeat block to make the code shorter.'
				},
				trigger: 'time',
				delaySeconds: 45
			}
		],
		canvas: {
			width: 400,
			height: 400,
			gridSize: 50,
			pathOverlay: [],
			targets: [],
			walls: []
		},
		grader: {
			appleTolerance: 25,
			wallTolerance: 0,
			testCases: [
				{
					id: 'square-state',
					description: { de: 'Zurück am Start', en: 'Back at start' },
					visible: true,
					type: 'state',
					expected: { state: { x: 200, y: 200, angle: 0, tolerance: 5 } }
				},
				{
					id: 'square-path',
					description: { de: 'Quadratischer Pfad', en: 'Square path' },
					visible: false,
					type: 'path',
					// move 2 north, turn 90, move 2 east, turn 90, move 2 south, turn 90, move 2 west, turn 90
					expected: {
						path: [
							{ x: 200, y: 200 },
							{ x: 200, y: 100 },
							{ x: 300, y: 100 },
							{ x: 300, y: 200 },
							{ x: 200, y: 200 }
						]
					}
				}
			]
		},
		mode: 'default'
	},
	published: true,
	order: 5,
	createdBy: teacherId,
	createdAt: now,
	updatedAt: now
});

// ── Turtle 3: Draw a Triangle ───────────────────────────────────────────────────
const turtleTriangle = await seedExercise({
	id: 'turtle-draw-triangle',
	courseId: mainCourseId,
	type: 'turtle',
	content: {
		title: { de: 'Zeichne ein Dreieck', en: 'Draw a Triangle' },
		description: {
			de: 'Zeichne ein gleichseitiges Dreieck mit Seitenlänge 3 Schritte.',
			en: 'Draw an equilateral triangle with side length 3 steps.'
		},
		image: ''
	},
	config: {
		toolbox: ['move', 'turn', 'math_number', 'controls_repeat_ext'],
		starterXml: EMPTY_STARTER_XML,
		hasStarterBlocks: false,
		hints: [
			{
				id: 'tri-hint1',
				text: {
					de: 'Ein gleichseitiges Dreieck hat Innenwinkel von 60°, aber die Schildkröte dreht den Außenwinkel: 120°.',
					en: 'An equilateral triangle has 60° inner angles, but the turtle turns the exterior angle: 120°.'
				},
				trigger: 'click'
			},
			{
				id: 'tri-hint2',
				text: {
					de: 'Wiederhole 3 mal: bewege 3 Schritte und drehe 120°.',
					en: 'Repeat 3 times: move 3 steps and turn 120°.'
				},
				trigger: 'time',
				delaySeconds: 60
			}
		],
		canvas: {
			width: 400,
			height: 400,
			gridSize: 50,
			pathOverlay: [],
			targets: [],
			walls: []
		},
		grader: {
			appleTolerance: 25,
			wallTolerance: 0,
			testCases: [
				{
					id: 'tri-state',
					description: { de: 'Zurück am Start', en: 'Back at start' },
					visible: true,
					type: 'state',
					expected: { state: { x: 200, y: 200, angle: 0, tolerance: 10 } }
				},
				{
					id: 'tri-commands',
					description: { de: 'Korrekte Befehle', en: 'Correct commands' },
					visible: false,
					type: 'commands',
					expected: {
						commands: [
							'move:3',
							'turn:120',
							'move:3',
							'turn:120',
							'move:3',
							'turn:120'
						]
					}
				}
			]
		},
		mode: 'default'
	},
	published: true,
	order: 6,
	createdBy: teacherId,
	createdAt: now,
	updatedAt: now
});

// ── Turtle 4: Draw a Star ───────────────────────────────────────────────────────
const turtleStar = await seedExercise({
	id: 'turtle-draw-star',
	courseId: mainCourseId,
	type: 'turtle',
	content: {
		title: { de: 'Zeichne einen Stern', en: 'Draw a Star' },
		description: {
			de: 'Zeichne einen fünfzackigen Stern. Die Schildkröte soll am Startpunkt enden.',
			en: 'Draw a five-pointed star. The turtle should end at the starting point.'
		},
		image: ''
	},
	config: {
		toolbox: ['move', 'turn', 'pen', 'color', 'math_number', 'controls_repeat_ext'],
		starterXml: EMPTY_STARTER_XML,
		hasStarterBlocks: false,
		hints: [
			{
				id: 'star-hint1',
				text: {
					de: 'Ein fünfzackiger Stern entsteht durch 5 mal: bewegen und 144° drehen.',
					en: 'A five-pointed star is made by repeating 5 times: move and turn 144°.'
				},
				trigger: 'click'
			},
			{
				id: 'star-hint2',
				text: {
					de: 'Der Drehwinkel ist 144° (= 360° × 2 / 5).',
					en: 'The turning angle is 144° (= 360° × 2 / 5).'
				},
				trigger: 'time',
				delaySeconds: 60
			}
		],
		canvas: {
			width: 400,
			height: 400,
			gridSize: 50,
			pathOverlay: [],
			targets: [],
			walls: []
		},
		grader: {
			appleTolerance: 25,
			wallTolerance: 0,
			testCases: [
				{
					id: 'star-state',
					description: { de: 'Zurück am Start', en: 'Back at start' },
					visible: true,
					type: 'state',
					expected: { state: { x: 200, y: 200, angle: 0, tolerance: 10 } }
				},
				{
					id: 'star-commands',
					description: { de: 'Korrekte Befehle', en: 'Correct commands' },
					visible: false,
					type: 'commands',
					expected: {
						commands: [
							'move:3',
							'turn:144',
							'move:3',
							'turn:144',
							'move:3',
							'turn:144',
							'move:3',
							'turn:144',
							'move:3',
							'turn:144'
						]
					}
				}
			]
		},
		mode: 'default'
	},
	published: true,
	order: 7,
	createdBy: teacherId,
	createdAt: now,
	updatedAt: now
});

// =============================================================================
// ROBOT EXERCISES (2)
// =============================================================================

// Robot grid: 8×8, cellSize 50 → canvas 400×400
// Robot starts at grid position, facing north (angle 0)
// Coordinates are in pixels: grid (col, row) → pixel (col * cellSize, row * cellSize)

// ── Robot 1: Navigate to Target ─────────────────────────────────────────────────
const robotNavigate = await seedExercise({
	id: 'robot-navigate',
	courseId: mainCourseId,
	type: 'robot',
	content: {
		title: { de: 'Navigiere zum Ziel', en: 'Navigate to Target' },
		description: {
			de: 'Steuere den Roboter von der Startposition zum Ziel (markiert mit einem Stern).',
			en: 'Guide the robot from the start to the target (marked with a star).'
		},
		image: ''
	},
	config: {
		toolbox: ['move', 'turn', 'math_number'],
		starterXml: EMPTY_STARTER_XML,
		hasStarterBlocks: false,
		hints: [
			{
				id: 'nav-hint1',
				text: {
					de: 'Der Roboter startet nach Norden. Drehe ihn zuerst in die richtige Richtung.',
					en: 'The robot starts facing north. Turn it to the correct direction first.'
				},
				trigger: 'click'
			},
			{
				id: 'nav-hint2',
				text: {
					de: 'Drehe 90° nach rechts, bewege 3 Schritte, drehe 90° nach links, bewege 2 Schritte.',
					en: 'Turn 90° right, move 3 steps, turn 90° left, move 2 steps.'
				},
				trigger: 'time',
				delaySeconds: 60
			}
		],
		canvas: {
			width: 400,
			height: 400,
			gridSize: 50,
			pathOverlay: [],
			targets: [{ x: 200, y: 50 }],
			walls: []
		},
		grid: {
			width: 8,
			height: 8,
			cellSize: 50,
			start: { x: 50, y: 150 },
			direction: 'north',
			walls: [],
			targets: [{ x: 200, y: 50 }],
			collectibles: []
		},
		grader: {
			appleTolerance: 25,
			wallTolerance: 0,
			testCases: [
				{
					id: 'nav-target',
					description: { de: 'Ziel erreicht', en: 'Reached the target' },
					visible: true,
					type: 'target',
					expected: { target: { x: 200, y: 50, tolerance: 25 } }
				},
				{
					id: 'nav-state',
					description: { de: 'Korrekte Endposition', en: 'Correct final position' },
					visible: false,
					type: 'state',
					expected: { state: { x: 200, y: 50, angle: 0, tolerance: 10 } }
				}
			]
		},
		mode: 'default'
	},
	published: true,
	order: 8,
	createdBy: teacherId,
	createdAt: now,
	updatedAt: now
});

// ── Robot 2: Collect Items ──────────────────────────────────────────────────────
const robotCollect = await seedExercise({
	id: 'robot-collect',
	courseId: mainCourseId,
	type: 'robot',
	content: {
		title: { de: 'Sammle die Gegenstände', en: 'Collect the Items' },
		description: {
			de: 'Steuere den Roboter, um alle 3 Gegenstände einzusammeln. Der Roboter sammelt automatisch, wenn er über einen Gegenstand fährt.',
			en: 'Guide the robot to collect all 3 items. The robot collects automatically when it moves over an item.'
		},
		image: ''
	},
	config: {
		toolbox: ['move', 'turn', 'math_number', 'controls_repeat_ext'],
		starterXml: EMPTY_STARTER_XML,
		hasStarterBlocks: false,
		hints: [
			{
				id: 'collect-hint1',
				text: {
					de: 'Die Gegenstände liegen in einer Reihe. Bewege den Roboter nach rechts.',
					en: 'The items are in a row. Move the robot to the right.'
				},
				trigger: 'click'
			},
			{
				id: 'collect-hint2',
				text: {
					de: 'Drehe 90° nach rechts und bewege dich dann 3 Schritte vorwärts.',
					en: 'Turn 90° right and then move 3 steps forward.'
				},
				trigger: 'time',
				delaySeconds: 45
			}
		],
		canvas: {
			width: 400,
			height: 400,
			gridSize: 50,
			pathOverlay: [],
			targets: [{ x: 150, y: 200 }, { x: 200, y: 200 }, { x: 250, y: 200 }],
			walls: []
		},
		grid: {
			width: 8,
			height: 8,
			cellSize: 50,
			start: { x: 100, y: 200 },
			direction: 'north',
			walls: [],
			targets: [],
			collectibles: [{ x: 150, y: 200 }, { x: 200, y: 200 }, { x: 250, y: 200 }]
		},
		grader: {
			appleTolerance: 25,
			wallTolerance: 0,
			testCases: [
				{
					id: 'collect-count',
					description: { de: 'Alle 3 Gegenstände eingesammelt', en: 'All 3 items collected' },
					visible: true,
					type: 'collect',
					expected: { collect: { count: 3 } }
				},
				{
					id: 'collect-path',
					description: { de: 'Korrekter Pfad', en: 'Correct path' },
					visible: false,
					type: 'state',
					expected: { state: { x: 250, y: 200, angle: 90, tolerance: 25 } }
				}
			]
		},
		mode: 'default'
	},
	published: true,
	order: 9,
	createdBy: teacherId,
	createdAt: now,
	updatedAt: now
});

// =============================================================================
// Course → Exercise Mappings
// =============================================================================

// Main course: all 10 exercises in progression order
await seedCourseExercises(mainCourseId, [
	ioEvenOdd,
	ioDoubleIt,
	ioSum,
	ioPrintGrid,
	turtleLine,
	turtleSquare,
	turtleTriangle,
	turtleStar,
	robotNavigate,
	robotCollect
]);

// Demo course: 3 exercises for guests (one of each type)
await seedCourseExercises(demoCourseId, [ioDoubleIt, turtleLine, robotNavigate]);

console.log('Seed complete: 2 courses, 10 exercises (4 IO, 4 turtle, 2 robot)');
