import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import {
	account,
	classUsers,
	classes,
	courseClasses,
	courseExercises,
	courses,
	exercises,
	user
} from '../src/lib/server/db/schema';
import { dehydrateExercise } from '../src/lib/types/exercise';

// =============================================================================
// Setup
// =============================================================================

if (!process.env.DATABASE_URL) {
	throw new Error('DATABASE_URL is not set');
}

const shouldReset = process.argv.includes('--reset');
const sqlitePath = process.env.DATABASE_URL.replace(/^file:/, '');
const client = new Database(sqlitePath);
client.exec('PRAGMA foreign_keys = ON');
const db = drizzle(client, {
	schema: { account, classUsers, classes, courseClasses, courseExercises, courses, exercises, user }
});

const now = Date.now();
const SEED_PASSWORD = process.env.SEED_TEACHER_PASSWORD ?? 'BlockQuiz123!';
const hashedPassword = await Bun.password.hash(SEED_PASSWORD);

// Deterministic RNG so reruns produce identical assignments.
function makeRng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const rng = makeRng(0xb10cb002);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
function shuffle<T>(arr: readonly T[]): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

// =============================================================================
// Optional reset
// =============================================================================

if (shouldReset) {
	client.exec('PRAGMA foreign_keys = OFF');
	for (const tbl of [
		'attempts',
		'achievements',
		'audit_logs',
		'exercise_versions',
		'course_exercises',
		'course_users',
		'course_classes',
		'class_users',
		'exercises',
		'classes',
		'courses',
		'idp_group_seen',
		'account',
		'session',
		'verification',
		'user'
	]) {
		try {
			client.exec(`DELETE FROM ${tbl}`);
		} catch {
			// table may not exist yet (e.g. fresh push); ignore.
		}
	}
	client.exec('PRAGMA foreign_keys = ON');
	console.log('Wiped seed-able tables');
}

// =============================================================================
// Users — 2 admins, 10 teachers, 240 students
// =============================================================================

type SeedUser = {
	id: string;
	name: string;
	email: string;
	role: 'admin' | 'teacher' | 'student';
};

const admins: SeedUser[] = [
	{ id: crypto.randomUUID(), name: 'Admin One', email: 'admin1@blockquiz.test', role: 'admin' },
	{ id: crypto.randomUUID(), name: 'Admin Two', email: 'admin2@blockquiz.test', role: 'admin' }
];

const teacherFirstNames = [
	'Anna',
	'Ben',
	'Clara',
	'David',
	'Elena',
	'Felix',
	'Greta',
	'Hannes',
	'Iris',
	'Jonas'
];
const teachers: SeedUser[] = teacherFirstNames.map((name, idx) => ({
	id: crypto.randomUUID(),
	name: `${name} Teacher`,
	// First teacher keeps the email/password that e2e tests rely on.
	email: idx === 0 ? 'seed-teacher@example.com' : `teacher-${name.toLowerCase()}@blockquiz.test`,
	role: 'teacher' as const
}));

const studentFirstNames = [
	'Alex',
	'Bea',
	'Cleo',
	'Dario',
	'Emil',
	'Frieda',
	'Greta',
	'Hugo',
	'Isi',
	'Jakob',
	'Karli',
	'Lina',
	'Mara',
	'Nils',
	'Olivia',
	'Paul',
	'Quirin',
	'Rosa',
	'Sami',
	'Tim',
	'Uli',
	'Vera',
	'Wanda',
	'Xenia',
	'Yara',
	'Zoe'
];

type Year = 1 | 2 | 3 | 4;
type Track = 'A' | 'B' | 'C';
type SeedClass = { id: string; year: Year; track: Track; nameDe: string; nameEn: string };

const allClasses: SeedClass[] = [];
for (const year of [1, 2, 3, 4] as const) {
	for (const track of ['A', 'B', 'C'] as const) {
		allClasses.push({
			id: crypto.randomUUID(),
			year,
			track,
			nameDe: `Klasse ${year}${track}`,
			nameEn: `Year ${year}${track}`
		});
	}
}

const students: SeedUser[] = [];
for (const cls of allClasses) {
	for (let i = 0; i < 20; i++) {
		const first = studentFirstNames[(i + cls.year * 7) % studentFirstNames.length];
		const handle = `${first.toLowerCase()}${i + 1}-y${cls.year}${cls.track.toLowerCase()}`;
		students.push({
			id: crypto.randomUUID(),
			name: `${first} ${cls.nameEn}-${i + 1}`,
			email: `student-${handle}@blockquiz.test`,
			role: 'student'
		});
	}
}

const allUsers: SeedUser[] = [...admins, ...teachers, ...students];

// Insert users + credential accounts.
for (const u of allUsers) {
	await db
		.insert(user)
		.values({
			id: u.id,
			name: u.name,
			email: u.email,
			emailVerified: true,
			role: u.role,
			active: true,
			createdAt: new Date(now),
			updatedAt: new Date(now)
		})
		.onConflictDoNothing();

	await db
		.insert(account)
		.values({
			id: `${u.id}-credential`,
			accountId: u.email,
			providerId: 'credential',
			userId: u.id,
			password: hashedPassword,
			createdAt: new Date(now),
			updatedAt: new Date(now)
		})
		.onConflictDoNothing();
}

// =============================================================================
// Classes + class memberships (20 students per class)
// =============================================================================

for (const cls of allClasses) {
	await db
		.insert(classes)
		.values({
			id: cls.id,
			name: cls.nameDe,
			description: `Year ${cls.year}, Track ${cls.track} — ${cls.nameEn}`,
			ssoProviderId: null,
			externalKey: null,
			createdBy: admins[0].id,
			createdAt: now,
			updatedAt: now
		})
		.onConflictDoNothing();
}

let studentIdx = 0;
for (const cls of allClasses) {
	for (let i = 0; i < 20; i++) {
		const student = students[studentIdx++];
		await db
			.insert(classUsers)
			.values({
				id: crypto.randomUUID(),
				classId: cls.id,
				userId: student.id,
				source: 'manual',
				addedBy: admins[0].id,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoNothing();
	}
}

// =============================================================================
// Exercises — 4 IO, 4 turtle (with start + finish), 2 robot
// =============================================================================

const EMPTY_STARTER_XML = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>';

const IO_NORMALIZATION = {
	trim: true,
	collapseWhitespace: true,
	caseInsensitive: false,
	normalizeLineEndings: true,
	decimalSeparator: '.' as const
};

type ExerciseSeed = Parameters<typeof dehydrateExercise>[0] & {
	tag: string;
};

function assignAuthor<T extends ExerciseSeed>(seed: T): T {
	return { ...seed, createdBy: pick(teachers).id };
}

const exerciseSeeds: ExerciseSeed[] = [
	// ── IO 1: Even or Odd ────────────────────────────────────────────────────────
	{
		tag: 'io-even-odd',
		id: crypto.randomUUID(),
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
				'text_prompt_ext',
				'text_print',
				'text',
				'variables_get',
				'variables_set',
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
					id: crypto.randomUUID(),
					text: {
						de: 'Prüfe den Rest bei Division durch 2.',
						en: 'Check the remainder when dividing by 2.'
					},
					trigger: 'click'
				},
				{
					id: crypto.randomUUID(),
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
						id: crypto.randomUUID(),
						description: { de: 'Beispiel: 4 → even', en: 'Example: 4 → even' },
						visible: true,
						stdin: '4',
						expectedStdout: 'even'
					},
					{
						id: crypto.randomUUID(),
						description: { de: 'Beispiel: 7 → odd', en: 'Example: 7 → odd' },
						visible: true,
						stdin: '7',
						expectedStdout: 'odd'
					},
					{
						id: crypto.randomUUID(),
						description: { de: 'Versteckter Test', en: 'Hidden test' },
						visible: false,
						stdin: '0',
						expectedStdout: 'even'
					},
					{
						id: crypto.randomUUID(),
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
		createdAt: now,
		updatedAt: now
	},

	// ── IO 2: Double It ──────────────────────────────────────────────────────────
	{
		tag: 'io-double-it',
		id: crypto.randomUUID(),
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
			toolbox: [
				'text_prompt_ext',
				'text_print',
				'variables_get',
				'variables_set',
				'math_number',
				'math_arithmetic'
			],
			starterXml: EMPTY_STARTER_XML,
			hasStarterBlocks: false,
			hints: [
				{
					id: crypto.randomUUID(),
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
						id: crypto.randomUUID(),
						description: { de: 'Beispiel: 5 → 10', en: 'Example: 5 → 10' },
						visible: true,
						stdin: '5',
						expectedStdout: '10'
					},
					{
						id: crypto.randomUUID(),
						description: { de: 'Versteckter Test', en: 'Hidden test' },
						visible: false,
						stdin: '0',
						expectedStdout: '0'
					},
					{
						id: crypto.randomUUID(),
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
		createdAt: now,
		updatedAt: now
	},

	// ── IO 3: Sum 1 to N ─────────────────────────────────────────────────────────
	{
		tag: 'io-sum-1-to-n',
		id: crypto.randomUUID(),
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
				'text_prompt_ext',
				'math_arithmetic',
				'controls_repeat_ext',
				'controls_for',
				'text_print',
				'math_number',
				'variables_get',
				'variables_set',
				'math_change'
			],
			starterXml: EMPTY_STARTER_XML,
			hasStarterBlocks: false,
			hints: [
				{
					id: crypto.randomUUID(),
					text: {
						de: 'Nutze eine Schleife und eine Summenvariable.',
						en: 'Use a loop and an accumulator variable.'
					},
					trigger: 'click'
				},
				{
					id: crypto.randomUUID(),
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
						id: crypto.randomUUID(),
						description: { de: 'Beispiel mit N = 3', en: 'Example with N = 3' },
						visible: true,
						stdin: '3',
						expectedStdout: '6'
					},
					{
						id: crypto.randomUUID(),
						description: { de: 'Beispiel mit N = 1', en: 'Example with N = 1' },
						visible: true,
						stdin: '1',
						expectedStdout: '1'
					},
					{
						id: crypto.randomUUID(),
						description: { de: 'Versteckter Test mit N = 5', en: 'Hidden test with N = 5' },
						visible: false,
						stdin: '5',
						expectedStdout: '15'
					},
					{
						id: crypto.randomUUID(),
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
		createdAt: now,
		updatedAt: now
	},

	// ── IO 4: Print Number Row ────────────────────────────────────────────────────
	{
		tag: 'io-print-row',
		id: crypto.randomUUID(),
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
				'text_prompt_ext',
				'text_print',
				'text',
				'text_join',
				'text_append',
				'math_number',
				'math_arithmetic',
				'controls_for',
				'controls_repeat_ext',
				'variables_get',
				'variables_set'
			],
			starterXml: EMPTY_STARTER_XML,
			hasStarterBlocks: false,
			hints: [
				{
					id: crypto.randomUUID(),
					text: {
						de: 'Baue einen Text in einer Schleife zusammen und gib ihn am Ende aus.',
						en: 'Build a string inside a loop and print it at the end.'
					},
					trigger: 'click'
				},
				{
					id: crypto.randomUUID(),
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
						id: crypto.randomUUID(),
						description: { de: 'Beispiel: N = 5', en: 'Example: N = 5' },
						visible: true,
						stdin: '5',
						expectedStdout: '1 2 3 4 5'
					},
					{
						id: crypto.randomUUID(),
						description: { de: 'Versteckter Test', en: 'Hidden test' },
						visible: false,
						stdin: '1',
						expectedStdout: '1'
					},
					{
						id: crypto.randomUUID(),
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
		createdAt: now,
		updatedAt: now
	},

	// ── Turtle 1: Draw a Line ──────────────────────────────────────────────────────
	{
		tag: 'turtle-line',
		id: crypto.randomUUID(),
		type: 'turtle',
		content: {
			title: { de: 'Zeichne eine Linie', en: 'Draw a Line' },
			description: {
				de: 'Bewege die Schildkröte 3 Schritte nach oben — vom Start (grün) zum Ziel (rot).',
				en: 'Move the turtle 3 steps upward — from the start (green) to the finish (red).'
			},
			image: ''
		},
		config: {
			toolbox: ['move', 'math_number'],
			starterXml: EMPTY_STARTER_XML,
			hasStarterBlocks: false,
			hints: [
				{
					id: crypto.randomUUID(),
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
				walls: [],
				start: { x: 200, y: 200 },
				finish: { x: 200, y: 50 }
			},
			grader: {
				appleTolerance: 25,
				wallTolerance: 0,
				testCases: [
					{
						id: crypto.randomUUID(),
						description: { de: 'Ziel erreicht', en: 'Reached the target' },
						visible: true,
						type: 'target',
						expected: { target: { x: 200, y: 50, tolerance: 25 } }
					},
					{
						id: crypto.randomUUID(),
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
		createdAt: now,
		updatedAt: now
	},

	// ── Turtle 2: Draw a Square ────────────────────────────────────────────────────
	{
		tag: 'turtle-square',
		id: crypto.randomUUID(),
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
					id: crypto.randomUUID(),
					text: {
						de: 'Wiederhole 4 mal: bewege 2 Schritte und drehe 90°.',
						en: 'Repeat 4 times: move 2 steps and turn 90°.'
					},
					trigger: 'click'
				},
				{
					id: crypto.randomUUID(),
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
				walls: [],
				start: { x: 200, y: 200 },
				finish: { x: 200, y: 200 }
			},
			grader: {
				appleTolerance: 25,
				wallTolerance: 0,
				testCases: [
					{
						id: crypto.randomUUID(),
						description: { de: 'Zurück am Start', en: 'Back at start' },
						visible: true,
						type: 'state',
						expected: { state: { x: 200, y: 200, angle: 0, tolerance: 5 } }
					},
					{
						id: crypto.randomUUID(),
						description: { de: 'Quadratischer Pfad', en: 'Square path' },
						visible: false,
						type: 'path',
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
		createdAt: now,
		updatedAt: now
	},

	// ── Turtle 3: Draw a Triangle ──────────────────────────────────────────────────
	{
		tag: 'turtle-triangle',
		id: crypto.randomUUID(),
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
					id: crypto.randomUUID(),
					text: {
						de: 'Ein gleichseitiges Dreieck hat Innenwinkel von 60°, aber die Schildkröte dreht den Außenwinkel: 120°.',
						en: 'An equilateral triangle has 60° inner angles, but the turtle turns the exterior angle: 120°.'
					},
					trigger: 'click'
				},
				{
					id: crypto.randomUUID(),
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
				walls: [],
				start: { x: 200, y: 200 },
				finish: { x: 200, y: 200 }
			},
			grader: {
				appleTolerance: 25,
				wallTolerance: 0,
				testCases: [
					{
						id: crypto.randomUUID(),
						description: { de: 'Zurück am Start', en: 'Back at start' },
						visible: true,
						type: 'state',
						expected: { state: { x: 200, y: 200, angle: 0, tolerance: 10 } }
					},
					{
						id: crypto.randomUUID(),
						description: { de: 'Korrekte Befehle', en: 'Correct commands' },
						visible: false,
						type: 'commands',
						expected: {
							commands: ['move:3', 'turn:120', 'move:3', 'turn:120', 'move:3', 'turn:120']
						}
					}
				]
			},
			mode: 'default'
		},
		published: true,
		order: 6,
		createdAt: now,
		updatedAt: now
	},

	// ── Turtle 4: Draw a Star ──────────────────────────────────────────────────────
	{
		tag: 'turtle-star',
		id: crypto.randomUUID(),
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
					id: crypto.randomUUID(),
					text: {
						de: 'Ein fünfzackiger Stern entsteht durch 5 mal: bewegen und 144° drehen.',
						en: 'A five-pointed star is made by repeating 5 times: move and turn 144°.'
					},
					trigger: 'click'
				},
				{
					id: crypto.randomUUID(),
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
				walls: [],
				start: { x: 200, y: 200 },
				finish: { x: 200, y: 200 }
			},
			grader: {
				appleTolerance: 25,
				wallTolerance: 0,
				testCases: [
					{
						id: crypto.randomUUID(),
						description: { de: 'Zurück am Start', en: 'Back at start' },
						visible: true,
						type: 'state',
						expected: { state: { x: 200, y: 200, angle: 0, tolerance: 10 } }
					},
					{
						id: crypto.randomUUID(),
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
		createdAt: now,
		updatedAt: now
	},

	// ── Robot 1: Navigate to Target ────────────────────────────────────────────────
	{
		tag: 'robot-navigate',
		id: crypto.randomUUID(),
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
			toolbox: ['step', 'turn_left', 'turn_right'],
			starterXml: EMPTY_STARTER_XML,
			hasStarterBlocks: false,
			hints: [
				{
					id: crypto.randomUUID(),
					text: {
						de: 'Der Roboter startet nach Norden. Drehe ihn mit "turn right" nach Osten.',
						en: 'The robot starts facing north. Use "turn right" to face east first.'
					},
					trigger: 'click'
				},
				{
					id: crypto.randomUUID(),
					text: {
						de: 'Turn right, dann 3× move forward, dann turn left, dann 2× move forward.',
						en: 'Turn right, move forward 3 times, turn left, then move forward 2 times.'
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
				walls: [],
				start: { x: 50, y: 150 },
				finish: { x: 200, y: 50 }
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
						id: crypto.randomUUID(),
						description: { de: 'Ziel erreicht', en: 'Reached the target' },
						visible: true,
						type: 'target',
						expected: { target: { x: 200, y: 50, tolerance: 25 } }
					},
					{
						id: crypto.randomUUID(),
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
		createdAt: now,
		updatedAt: now
	},

	// ── Robot 2: Collect Items ─────────────────────────────────────────────────────
	{
		tag: 'robot-collect',
		id: crypto.randomUUID(),
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
			toolbox: ['step', 'turn_left', 'turn_right', 'collect', 'controls_repeat_ext'],
			starterXml: EMPTY_STARTER_XML,
			hasStarterBlocks: false,
			hints: [
				{
					id: crypto.randomUUID(),
					text: {
						de: 'Die Gegenstände liegen in einer Reihe nach rechts. Drehe den Roboter zuerst nach Osten.',
						en: 'The items are in a row to the right. Turn the robot east first.'
					},
					trigger: 'click'
				},
				{
					id: crypto.randomUUID(),
					text: {
						de: 'Turn right, dann 3× move forward – der Roboter sammelt die Gegenstände automatisch ein.',
						en: 'Turn right, then move forward 3 times – the robot collects items automatically.'
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
				targets: [
					{ x: 150, y: 200 },
					{ x: 200, y: 200 },
					{ x: 250, y: 200 }
				],
				walls: [],
				start: { x: 100, y: 200 },
				finish: { x: 250, y: 200 }
			},
			grid: {
				width: 8,
				height: 8,
				cellSize: 50,
				start: { x: 100, y: 200 },
				direction: 'north',
				walls: [],
				targets: [],
				collectibles: [
					{ x: 150, y: 200 },
					{ x: 200, y: 200 },
					{ x: 250, y: 200 }
				]
			},
			grader: {
				appleTolerance: 25,
				wallTolerance: 0,
				testCases: [
					{
						id: crypto.randomUUID(),
						description: { de: 'Alle 3 Gegenstände eingesammelt', en: 'All 3 items collected' },
						visible: true,
						type: 'collect',
						expected: { collect: { count: 3 } }
					},
					{
						id: crypto.randomUUID(),
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
		createdAt: now,
		updatedAt: now
	}
].map((seed) => assignAuthor(seed as ExerciseSeed));

const exercisesByTag = new Map<string, string>();

async function seedExercise(input: ExerciseSeed) {
	const { tag, ...rest } = input;
	const { exercise, content, config, validation } = dehydrateExercise(rest);
	await db
		.insert(exercises)
		.values({
			id: exercise.id,
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
	exercisesByTag.set(tag, exercise.id);
	return exercise.id;
}

for (const seed of exerciseSeeds) {
	await seedExercise(seed);
}

const exId = (tag: string): string => {
	const id = exercisesByTag.get(tag);
	if (!id) throw new Error(`Missing exercise tag: ${tag}`);
	return id;
};

// =============================================================================
// Courses — one per theme, plus a public demo
// =============================================================================

type SeedCourse = {
	titleDe: string;
	titleEn: string;
	descDe: string;
	descEn: string;
	exerciseTags: string[];
	published: boolean;
	// 'all' = assign to every class (so every student has access); number = pick that many at random.
	classAssignment: number | 'all';
};

const seedCourses: SeedCourse[] = [
	{
		titleDe: 'BlockQuiz Demo',
		titleEn: 'BlockQuiz Demo',
		descDe: 'Probiere BlockQuiz aus! Drei kurze Aufgaben zum Kennenlernen – kein Login nötig.',
		descEn: 'Try BlockQuiz! Three short exercises to get started – no login required.',
		exerciseTags: ['io-double-it', 'turtle-line', 'robot-navigate'],
		published: true,
		classAssignment: 0
	},
	{
		titleDe: 'Einführung Programmieren',
		titleEn: 'Intro to Programming',
		descDe: 'Grundlagenkurs mit Blockly-Aufgaben: Textausgabe, Turtle-Grafik und Robotersteuerung.',
		descEn: 'Foundations course with Blockly exercises: text output, turtle graphics, and robot control.',
		exerciseTags: [
			'io-even-odd',
			'io-double-it',
			'io-sum-1-to-n',
			'io-print-row',
			'turtle-line',
			'turtle-square',
			'turtle-triangle',
			'turtle-star',
			'robot-navigate',
			'robot-collect'
		],
		published: true,
		classAssignment: 'all'
	},
	{
		titleDe: 'Turtle-Grafik',
		titleEn: 'Turtle Graphics',
		descDe: 'Lerne Schleifen und Geometrie mit der Schildkröte.',
		descEn: 'Learn loops and geometry with the turtle.',
		exerciseTags: ['turtle-line', 'turtle-square', 'turtle-triangle', 'turtle-star'],
		published: true,
		classAssignment: 2
	},
	{
		titleDe: 'Roboter-Abenteuer',
		titleEn: 'Robot Adventures',
		descDe: 'Navigiere den Roboter durch das Spielfeld und sammle Gegenstände.',
		descEn: 'Navigate the robot through the field and collect items.',
		exerciseTags: ['robot-navigate', 'robot-collect'],
		published: true,
		classAssignment: 2
	},
	{
		titleDe: 'I/O Grundlagen',
		titleEn: 'I/O Basics',
		descDe: 'Eingabe und Ausgabe von Text und Zahlen mit Blockly.',
		descEn: 'Input and output of text and numbers with Blockly.',
		exerciseTags: ['io-even-odd', 'io-double-it', 'io-sum-1-to-n', 'io-print-row'],
		published: true,
		classAssignment: 2
	},
	{
		titleDe: 'Gemischte Herausforderung',
		titleEn: 'Mixed Challenge',
		descDe: 'Eine bunte Mischung aus allen Aufgabentypen.',
		descEn: 'A colourful mix of all exercise types.',
		exerciseTags: shuffle([
			'io-sum-1-to-n',
			'turtle-square',
			'robot-collect',
			'io-print-row',
			'turtle-star'
		]),
		published: true,
		classAssignment: 3
	}
];

for (const c of seedCourses) {
	const courseId = crypto.randomUUID();
	const author = pick(teachers);
	await db
		.insert(courses)
		.values({
			id: courseId,
			content: {
				title: { de: c.titleDe, en: c.titleEn },
				description: { de: c.descDe, en: c.descEn },
				image: ''
			},
			published: c.published,
			createdAt: now,
			updatedAt: new Date(now),
			createdBy: author.id
		})
		.onConflictDoNothing();

	for (const [order, tag] of c.exerciseTags.entries()) {
		await db
			.insert(courseExercises)
			.values({
				id: crypto.randomUUID(),
				courseId,
				exerciseId: exId(tag),
				order,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoNothing();
	}

	// Assign classes: 0 = none (demo is public-only), 'all' = every class (so the
	// foundational course reaches every student), N = N random classes.
	const assignedClasses =
		c.classAssignment === 'all'
			? allClasses
			: c.classAssignment > 0
				? shuffle(allClasses).slice(0, c.classAssignment)
				: [];
	if (assignedClasses.length > 0) {
		for (const cls of assignedClasses) {
			await db
				.insert(courseClasses)
				.values({
					id: crypto.randomUUID(),
					courseId,
					classId: cls.id,
					addedBy: admins[0].id,
					createdAt: now,
					updatedAt: now
				})
				.onConflictDoNothing();
		}
	}
}

// =============================================================================
// Summary
// =============================================================================

console.log(
	`Seed complete:\n` +
		`  ${admins.length} admin${admins.length === 1 ? '' : 's'}\n` +
		`  ${teachers.length} teachers (login: seed-teacher@example.com / ${SEED_PASSWORD})\n` +
		`  ${students.length} students across ${allClasses.length} classes (20 each, 4 years × 3 tracks)\n` +
		`  ${exerciseSeeds.length} exercises (4 IO, 4 turtle, 2 robot) authored by random teachers\n` +
		`  ${seedCourses.length} courses (random teacher author; Intro reaches every class, themed courses get 2–3 random classes, demo is public-only)`
);
