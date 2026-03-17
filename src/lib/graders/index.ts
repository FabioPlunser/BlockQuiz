import type { Command, Point, PositionState } from '$lib/canvas/types';
import type {
	Exercise,
	IoExercise,
	IoNormalization,
	IoTestCase,
	RobotExercise,
	RobotTestCase,
	TestCase,
	TurtleExercise,
	TurtleTestCase
} from '$lib/types/exercise';

export interface GraderTestResult {
	id: string;
	description: string;
	visible: boolean;
	passed: boolean;
	message: string;
	expected?: string;
	actual?: string;
}

export interface GradingResult {
	passed: boolean;
	score: number;
	totalTests: number;
	passedTests: number;
	testResults: GraderTestResult[];
}

export interface IoExecutionSample {
	success: boolean;
	stdout?: string;
	error?: string;
}

export interface VisualExecutionSample {
	success: boolean;
	commands: Command[];
	error?: string;
}

interface SimulatedVisualTrace {
	finalState: PositionState;
	path: Point[];
	collectedCount: number;
}

function describeLocalized(value: { de: string; en: string } | undefined): string {
	if (!value) {
		return '';
	}

	return value.en || value.de || '';
}

export function calculateScore(passed: number, total: number): number {
	if (total === 0) {
		return 0;
	}

	return Math.round((passed / total) * 100);
}

function buildGradingResult(testResults: GraderTestResult[]): GradingResult {
	const passedTests = testResults.filter((test) => test.passed).length;
	return {
		passed: testResults.length > 0 && passedTests === testResults.length,
		score: calculateScore(passedTests, testResults.length),
		totalTests: testResults.length,
		passedTests,
		testResults
	};
}

export function normalizeIoText(value: string, normalization: IoNormalization): string {
	let normalized = value ?? '';

	if (normalization.normalizeLineEndings) {
		normalized = normalized.replace(/\r\n?/g, '\n');
	}

	if (normalization.decimalSeparator === 'either') {
		normalized = normalized.replace(/(\d),(\d)/g, '$1.$2');
	} else if (normalization.decimalSeparator === '.') {
		normalized = normalized.replace(/(\d),(\d)/g, '$1.$2');
	} else if (normalization.decimalSeparator === ',') {
		normalized = normalized.replace(/(\d)\.(\d)/g, '$1,$2');
	}

	if (normalization.collapseWhitespace) {
		normalized = normalized.replace(/\s+/g, ' ');
	}

	if (normalization.trim) {
		normalized = normalized.trim();
	}

	if (normalization.caseInsensitive) {
		normalized = normalized.toLocaleLowerCase();
	}

	return normalized;
}

function formatPoint(point: Point | PositionState): string {
	return `(${point.x}, ${point.y})`;
}

function formatState(state: PositionState): string {
	return `${formatPoint(state)}, angle ${state.angle}`;
}

function formatCommands(commands: Command[]): string {
	return commands.map(serializeCommand).join(', ');
}

function serializeCommand(command: Command): string {
	return command.args.length === 0 ? command.type : `${command.type}:${command.args.join(',')}`;
}

function distanceBetween(a: Point, b: Point): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

function angleDifference(a: number, b: number): number {
	const raw = Math.abs(a - b) % 360;
	return Math.min(raw, 360 - raw);
}

function createExecutionFailureResults(testCases: TestCase[], error: string): GradingResult {
	return buildGradingResult(
		testCases.map((test) => ({
			id: test.id,
			description: describeLocalized(test.description),
			visible: test.visible,
			passed: false,
			message: error
		}))
	);
}

export function gradeIoExercise(
	exercise: IoExercise,
	testRuns: Array<{ test: IoTestCase; execution: IoExecutionSample }>
): GradingResult {
	const testResults = testRuns.map(({ test, execution }) => {
		const actual = normalizeIoText(execution.stdout ?? '', exercise.io.normalization);
		const expected = normalizeIoText(test.expectedStdout, exercise.io.normalization);
		const passed = execution.success && actual === expected;
		const authoredMessage = describeLocalized(test.message);

		let message = authoredMessage || 'Output matches the expected result.';
		if (!passed) {
			message = execution.success
				? 'Output does not match the expected result.'
				: execution.error || 'Execution failed.';
		}

		return {
			id: test.id,
			description: describeLocalized(test.description),
			visible: test.visible,
			passed,
			message,
			expected: test.visible ? test.expectedStdout : undefined,
			actual: test.visible ? execution.stdout ?? '' : undefined
		} satisfies GraderTestResult;
	});

	return buildGradingResult(testResults);
}

function simulateTurtle(exercise: TurtleExercise, commands: Command[]): SimulatedVisualTrace {
	let state: PositionState = {
		x: exercise.canvas.width / 2,
		y: exercise.canvas.height / 2,
		angle: 0
	};
	const path: Point[] = [{ x: state.x, y: state.y }];

	for (const command of commands) {
		if (command.type === 'move') {
			const steps = Number(command.args[0] ?? 0);
			const distance = steps * exercise.canvas.gridSize;
			const radians = (state.angle * Math.PI) / 180;
			state = {
				...state,
				x: state.x + distance * Math.sin(radians),
				y: state.y - distance * Math.cos(radians)
			};
			path.push({ x: state.x, y: state.y });
			continue;
		}

		if (command.type === 'turn') {
			const degrees = Number(command.args[0] ?? 0);
			let nextAngle = (state.angle + degrees) % 360;
			if (nextAngle < 0) {
				nextAngle += 360;
			}
			state = {
				...state,
				angle: nextAngle
			};
		}
	}

	return {
		finalState: state,
		path,
		collectedCount: 0
	};
}

function directionToAngle(direction: RobotExercise['grid']['direction']): number {
	switch (direction) {
		case 'east':
			return 90;
		case 'south':
			return 180;
		case 'west':
			return 270;
		default:
			return 0;
	}
}

function simulateRobot(exercise: RobotExercise, commands: Command[]): SimulatedVisualTrace {
	let state: PositionState = {
		x: exercise.grid.start.x,
		y: exercise.grid.start.y,
		angle: directionToAngle(exercise.grid.direction)
	};
	const path: Point[] = [{ x: state.x, y: state.y }];
	const collectibles = exercise.grid.collectibles ?? [];
	const collected = new Set<number>();

	const collectAtPosition = () => {
		for (const [index, collectible] of collectibles.entries()) {
			if (collected.has(index)) {
				continue;
			}

			if (distanceBetween(state, collectible) <= 0.001) {
				collected.add(index);
			}
		}
	};

	collectAtPosition();

	for (const command of commands) {
		if (command.type === 'move') {
			const steps = Number(command.args[0] ?? 0);
			const distance = steps * exercise.grid.cellSize;
			const radians = (state.angle * Math.PI) / 180;
			state = {
				...state,
				x: state.x + distance * Math.sin(radians),
				y: state.y - distance * Math.cos(radians)
			};
			path.push({ x: state.x, y: state.y });
			collectAtPosition();
			continue;
		}

		if (command.type === 'turn') {
			const degrees = Number(command.args[0] ?? 0);
			let nextAngle = (state.angle + degrees) % 360;
			if (nextAngle < 0) {
				nextAngle += 360;
			}
			state = {
				...state,
				angle: nextAngle
			};
			continue;
		}

		if (command.type === 'collect') {
			collectAtPosition();
		}
	}

	return {
		finalState: state,
		path,
		collectedCount: collected.size
	};
}

function getPathTolerance(exercise: TurtleExercise | RobotExercise): number {
	if (exercise.grader.appleTolerance > 0) {
		return exercise.grader.appleTolerance;
	}

	const stepSize = exercise.type === 'turtle' ? exercise.canvas.gridSize : exercise.grid.cellSize;
	return Math.max(10, stepSize / 4);
}

function gradePath(
	expectedPath: Point[],
	actualPath: Point[],
	tolerance: number
): { passed: boolean; message: string; expected: string; actual: string } {
	if (expectedPath.length !== actualPath.length) {
		return {
			passed: false,
			message: `Expected ${expectedPath.length} path points but got ${actualPath.length}.`,
			expected: `Path with ${expectedPath.length} points`,
			actual: `Path with ${actualPath.length} points`
		};
	}

	for (const [index, expectedPoint] of expectedPath.entries()) {
		const actualPoint = actualPath[index];
		const delta = distanceBetween(expectedPoint, actualPoint);
		if (delta > tolerance) {
			return {
				passed: false,
				message: `Path diverged at point ${index + 1} by ${delta.toFixed(1)} pixels.`,
				expected: expectedPath.map(formatPoint).join(' -> '),
				actual: actualPath.map(formatPoint).join(' -> ')
			};
		}
	}

	return {
		passed: true,
		message: 'Path matches the expected route.',
		expected: expectedPath.map(formatPoint).join(' -> '),
		actual: actualPath.map(formatPoint).join(' -> ')
	};
}

function gradeVisualTestCase(
	exercise: TurtleExercise | RobotExercise,
	test: TurtleTestCase | RobotTestCase,
	simulation: SimulatedVisualTrace,
	commands: Command[]
): GraderTestResult {
	const authoredMessage = describeLocalized(test.message);
	const commandOutput = formatCommands(commands);

	switch (test.type) {
		case 'target': {
			const target = test.expected.target;
			if (!target) {
				return {
					id: test.id,
					description: describeLocalized(test.description),
					visible: test.visible,
					passed: false,
					message: 'Target expectation is not configured.'
				};
			}

			const tolerance = target.tolerance ?? exercise.grader.appleTolerance ?? 0;
			const distance = distanceBetween(simulation.finalState, target);
			const passed = distance <= tolerance;

			return {
				id: test.id,
				description: describeLocalized(test.description),
				visible: test.visible,
				passed,
				message: passed
					? authoredMessage || 'Reached the expected target.'
					: `Ended ${distance.toFixed(1)} pixels away from the target.`,
				expected: test.visible ? formatPoint(target) : undefined,
				actual: test.visible ? formatPoint(simulation.finalState) : undefined
			};
		}

		case 'commands': {
			const expectedCommands = test.expected.commands ?? [];
			const expectedOutput = expectedCommands.join(', ');
			const passed = JSON.stringify(expectedCommands) === JSON.stringify(commands.map(serializeCommand));

			return {
				id: test.id,
				description: describeLocalized(test.description),
				visible: test.visible,
				passed,
				message: passed
					? authoredMessage || 'Executed the expected commands.'
					: 'Executed a different command sequence.',
				expected: test.visible ? expectedOutput : undefined,
				actual: test.visible ? commandOutput : undefined
			};
		}

		case 'state': {
			const expectedState = test.expected.state;
			if (!expectedState) {
				return {
					id: test.id,
					description: describeLocalized(test.description),
					visible: test.visible,
					passed: false,
					message: 'State expectation is not configured.'
				};
			}

			const positionDelta = distanceBetween(simulation.finalState, expectedState);
			const angleDelta = angleDifference(simulation.finalState.angle, expectedState.angle);
			const passed =
				positionDelta <= expectedState.tolerance && angleDelta <= expectedState.tolerance;

			return {
				id: test.id,
				description: describeLocalized(test.description),
				visible: test.visible,
				passed,
				message: passed
					? authoredMessage || 'Reached the expected final state.'
					: `State mismatch: ${positionDelta.toFixed(1)}px position delta, ${angleDelta.toFixed(1)}deg angle delta.`,
				expected: test.visible ? formatState(expectedState) : undefined,
				actual: test.visible ? formatState(simulation.finalState) : undefined
			};
		}

		case 'path': {
			const expectedPath = test.expected.path ?? [];
			const result = gradePath(expectedPath, simulation.path, getPathTolerance(exercise));
			return {
				id: test.id,
				description: describeLocalized(test.description),
				visible: test.visible,
				passed: result.passed,
				message: result.passed ? authoredMessage || result.message : result.message,
				expected: test.visible ? result.expected : undefined,
				actual: test.visible ? result.actual : undefined
			};
		}

		case 'collect': {
			const expectedCollect = test.expected.collect;
			if (!expectedCollect) {
				return {
					id: test.id,
					description: describeLocalized(test.description),
					visible: test.visible,
					passed: false,
					message: 'Collect expectation is not configured.'
				};
			}

			const passed = simulation.collectedCount === expectedCollect.count;
			return {
				id: test.id,
				description: describeLocalized(test.description),
				visible: test.visible,
				passed,
				message: passed
					? authoredMessage || 'Collected the expected number of items.'
					: `Collected ${simulation.collectedCount} items instead of ${expectedCollect.count}.`,
				expected: test.visible ? String(expectedCollect.count) : undefined,
				actual: test.visible ? String(simulation.collectedCount) : undefined
			};
		}
	}
}

export function gradeVisualExercise(
	exercise: TurtleExercise | RobotExercise,
	execution: VisualExecutionSample
): GradingResult {
	const testCases = exercise.grader.testCases;
	if (!execution.success) {
		return createExecutionFailureResults(testCases, execution.error || 'Execution failed.');
	}

	const simulation =
		exercise.type === 'turtle'
			? simulateTurtle(exercise, execution.commands)
			: simulateRobot(exercise, execution.commands);

	return buildGradingResult(
		testCases.map((test) => gradeVisualTestCase(exercise, test, simulation, execution.commands))
	);
}

export function gradeExercise(
	exercise: Exercise,
	execution: VisualExecutionSample,
	ioRuns: Array<{ test: IoTestCase; execution: IoExecutionSample }> = []
): GradingResult {
	if (exercise.type === 'io') {
		return gradeIoExercise(exercise, ioRuns);
	}

	return gradeVisualExercise(exercise, execution);
}
