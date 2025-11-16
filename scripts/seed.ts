// scripts/seed.ts
import { db } from '$lib/db/client';
import { exercises, quizzes } from '$lib/db/schema';
import { ulid } from 'ulid';

await db
  .insert(exercises)
  .values({
    id: 'sum-1-to-n',
    type: 'io',
    metaJson: JSON.stringify({
      difficulty: 2,
      tags: ['loops', 'variables', 'math'],
      ageBand: '8-10',
      estimatedTime: 5,
    }),
    contentJson: JSON.stringify({
      title: { de: 'Summe 1 bis N', en: 'Sum 1 to N' },
      description: {
        de: 'Berechne die Summe der Zahlen von 1 bis N und gib sie aus.',
        en: 'Compute the sum of numbers from 1 to N and print it.',
      },
      hints: [
        { de: 'Nutze eine Schleife und eine Variable.', en: 'Use a loop and a variable.' },
        { de: 'Starte bei 1 und addiere bis N.', en: 'Start at 1 and add up to N.' },
      ],
    }),
    toolboxJson: JSON.stringify([
      'variables_set',
      'math_arithmetic',
      'controls_repeat_ext',
      'text_print',
      'math_number',
    ]),
    starterXml: '<xml></xml>',
    graderJson: JSON.stringify({
      normalize: true,
      tests: [
        { id: 't1', input: '3', expected: '6', visible: true },
        { id: 't2', input: '5', expected: '15', visible: false },
      ],
    }),
    status: 'published',
    createdBy: null,
    updatedBy: null,
  })
  .onConflictDoNothing();

await db
  .insert(quizzes)
  .values({
    id: 'intro-programming',
    titleJson: JSON.stringify({ de: 'Einführung Programmieren', en: 'Intro to Programming' }),
    exercisesJson: JSON.stringify(['sum-1-to-n']),
    randomize: false,
  })
  .onConflictDoNothing();

console.log('Seed done');