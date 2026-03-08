import { db } from '$lib/server/db/client';
import { courseExercises, courses, exercises, user } from '$lib/server/db/schema';
import { dehydrateExercise } from '$lib/types/exercise';

const teacherId = 'seed-teacher';
const courseId = 'intro-programming';
const exerciseId = 'sum-1-to-n';
const now = Date.now();

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

await db
	.insert(courses)
	.values({
		id: courseId,
		content: {
			title: { de: 'Einführung Programmieren', en: 'Intro to Programming' },
			description: {
				de: 'Grundlagenkurs mit ersten Blockly-Aufgaben.',
				en: 'Foundations course with introductory Blockly exercises.'
			},
			image: ''
		},
		published: true,
		createdAt: now,
		updatedAt: new Date(now),
		createdBy: teacherId
	})
	.onConflictDoNothing();

const seededExercise = dehydrateExercise({
	id: exerciseId,
	courseId,
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
			'variables_set',
			'math_arithmetic',
			'controls_repeat_ext',
			'text_print',
			'math_number'
		],
		starterXml: '<xml xmlns="https://developers.google.com/blockly/xml"></xml>',
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
			normalization: {
				trim: true,
				collapseWhitespace: true,
				caseInsensitive: false,
				normalizeLineEndings: true,
				decimalSeparator: '.'
			},
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
					id: 'sum-hidden',
					description: { de: 'Versteckter Test mit N = 5', en: 'Hidden test with N = 5' },
					visible: false,
					stdin: '5',
					expectedStdout: '15'
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

await db
	.insert(exercises)
	.values({
		id: seededExercise.exercise.id,
		courseId: seededExercise.exercise.courseId,
		type: seededExercise.exercise.type,
		image: seededExercise.exercise.content.image ?? '',
		content: seededExercise.content,
		config: seededExercise.config,
		validationJson: seededExercise.validation,
		published: seededExercise.exercise.published,
		order: seededExercise.exercise.order,
		createdBy: seededExercise.exercise.createdBy,
		createdAt: seededExercise.exercise.createdAt,
		updatedAt: seededExercise.exercise.updatedAt
	})
	.onConflictDoNothing();

await db
	.insert(courseExercises)
	.values({
		id: 'intro-programming-sum-1-to-n',
		courseId,
		exerciseId,
		order: 0,
		createdAt: now,
		updatedAt: now
	})
	.onConflictDoNothing();

console.log('Seed done');
