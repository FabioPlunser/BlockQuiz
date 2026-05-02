# Import And Export JSON

BlockQuiz exports plain JSON from the CMS and imports the same transfer formats again. Use the CMS export buttons whenever possible; the examples below document the stable envelope for testing, support, and manual inspection.

Imported courses and exercises are always saved as drafts, even when the JSON says `published: true`. Teachers must review and publish them again after import.

## Transfer Envelopes

Exercise transfer:

```ts
{
	schemaVersion: 1;
	kind: 'exercise';
	exportedAt: number;
	exercise: ExportedExercise;
}
```

Course transfer:

```ts
{
	schemaVersion: 1;
	kind: 'course';
	exportedAt: number;
	course: ExportedCourse;
	exercises: ExportedExercise[];
}
```

Shared exercise shape:

```ts
type ExportedExercise = {
	type: 'io' | 'turtle' | 'robot';
	content: {
		title: { de: string; en: string };
		description: { de: string; en: string };
		image?: string;
	};
	config: unknown;
	published?: boolean;
	order?: number;
	originalId?: string;
};
```

Course shape:

```ts
type ExportedCourse = {
	content: {
		title: { de: string; en: string };
		description: { de: string; en: string };
		image?: string;
	};
	published?: boolean;
	originalId?: string;
};
```

## Config Notes

Top-level validation checks `schemaVersion`, `kind`, localized course content, exercise `type`, and the transfer envelope. Exercise `config` is normalized by the same domain code used by the CMS.

Recommended config fields:

- All exercise types: `toolbox`, `starterXml`, `hasStarterBlocks`, `hints`, `mode`.
- `io`: `io.mode`, `io.tests`, `io.normalization`, optional visible example input/output.
- `turtle`: `canvas.width`, `canvas.height`, `canvas.gridSize`, `canvas.targets`, `canvas.walls`, `grader.testCases`.
- `robot`: `grid.width`, `grid.height`, `grid.cellSize`, `grid.start`, `grid.direction`, `grid.targets`, `grid.walls`, optional `grid.collectibles`, `grader.testCases`.

For robot exercises, positions currently use the same numeric coordinate system as the runtime canvas. `width * cellSize` and `height * cellSize` define the runtime area.

To publish an imported exercise later, the normalized exercise must still satisfy publish validation: DE/EN title and description, at least one test case, at least one hidden test case, valid starter XML when present, and type-specific config values.

## Exercise Example

This is a minimal `io` exercise transfer.

```json
{
	"schemaVersion": 1,
	"kind": "exercise",
	"exportedAt": 1710000000000,
	"exercise": {
		"originalId": "io-even-odd",
		"type": "io",
		"content": {
			"title": { "de": "Gerade oder Ungerade", "en": "Even or Odd" },
			"description": {
				"de": "Lies eine Zahl ein und gib even oder odd aus.",
				"en": "Read a number and print even or odd."
			},
			"image": ""
		},
		"config": {
			"toolbox": ["text_print", "math_number", "math_number_property", "controls_if"],
			"starterXml": "",
			"hasStarterBlocks": false,
			"hints": [
				{
					"id": "even-odd-hint",
					"text": {
						"de": "Pruefe, ob die Zahl durch 2 teilbar ist.",
						"en": "Check whether the number is divisible by 2."
					},
					"trigger": "click"
				}
			],
			"io": {
				"mode": "stdin-stdout",
				"normalization": {
					"trim": true,
					"collapseWhitespace": false,
					"caseInsensitive": false,
					"normalizeLineEndings": true,
					"decimalSeparator": "."
				},
				"visibleExampleInput": "4",
				"visibleExampleOutput": "even",
				"tests": [
					{
						"id": "even-odd-visible",
						"description": { "de": "Beispiel: 4", "en": "Example: 4" },
						"visible": true,
						"stdin": "4",
						"expectedStdout": "even"
					},
					{
						"id": "even-odd-hidden",
						"description": { "de": "Versteckter Test", "en": "Hidden test" },
						"visible": false,
						"stdin": "7",
						"expectedStdout": "odd"
					}
				]
			},
			"mode": "default"
		},
		"published": true,
		"order": 0
	}
}
```

## Course Example

Course imports preserve the exercise array order for the imported course assignment. This example contains one robot exercise.

```json
{
	"schemaVersion": 1,
	"kind": "course",
	"exportedAt": 1710000000000,
	"course": {
		"originalId": "course-basics",
		"content": {
			"title": { "de": "Programmier-Basics", "en": "Programming Basics" },
			"description": {
				"de": "Erste Aufgaben mit Bloecken.",
				"en": "First tasks with blocks."
			},
			"image": ""
		},
		"published": true
	},
	"exercises": [
		{
			"originalId": "robot-target",
			"type": "robot",
			"content": {
				"title": { "de": "Zum Ziel", "en": "To the Target" },
				"description": {
					"de": "Steuere den Roboter zum Stern.",
					"en": "Guide the robot to the star."
				},
				"image": ""
			},
			"config": {
				"toolbox": ["move", "turn", "math_number"],
				"starterXml": "",
				"hasStarterBlocks": false,
				"hints": [],
				"grid": {
					"width": 8,
					"height": 8,
					"cellSize": 50,
					"start": { "x": 50, "y": 150 },
					"direction": "north",
					"walls": [],
					"targets": [{ "x": 200, "y": 50 }],
					"collectibles": []
				},
				"grader": {
					"appleTolerance": 25,
					"wallTolerance": 0,
					"testCases": [
						{
							"id": "robot-visible-target",
							"description": { "de": "Ziel erreicht", "en": "Reached the target" },
							"visible": true,
							"type": "target",
							"expected": { "target": { "x": 200, "y": 50, "tolerance": 25 } }
						},
						{
							"id": "robot-hidden-state",
							"description": { "de": "Endposition", "en": "Final position" },
							"visible": false,
							"type": "state",
							"expected": { "state": { "x": 200, "y": 50, "angle": 0, "tolerance": 10 } }
						}
					]
				},
				"mode": "default"
			},
			"published": true,
			"order": 0
		}
	]
}
```
