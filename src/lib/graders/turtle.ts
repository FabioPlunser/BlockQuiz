export interface TurtleState {
	x: number;
	y: number;
	angle: number;
	penDown: boolean;
}

export interface TurtleTest {
	id: string;
	description: { de: string, en: string };
	visible: boolean;
	type: 'target' | 'commands' | 'state';
	message?: { de: string, en: string };
	expected: {
		target?: { x: number, y: number, tolerance?: number };
		commands?: string[];
		state?: { x: number, y: number, angle: number, tolerance: number };
	};
}

export interface GradeResult {
	passed: boolean;
	score: number;
	tests: Array<TurtleTest & { passed: boolean; message: string }>;
}

export interface CanvasConfig {
	width: number;
	height: number;
	gridSize: number;
}

const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
	width: 400,
	height: 400,
	gridSize: 50
};

/**
 * Simulate turtle movement based on command log.
 * Commands are in format "move:1", "turn:90", etc.
 * Move distance is in CELLS (grid units), which gets multiplied by gridSize.
 */
export function simulateTurtle(
	commands: string[],
	config: CanvasConfig = DEFAULT_CANVAS_CONFIG
): TurtleState {
	// Start at center of canvas
	let x = config.width / 2;
	let y = config.height / 2;
	let angle = 0;
	let penDown = true;

	for (const cmd of commands) {
		const [op, ...args] = cmd.split(':');
		if (op === 'move') {
			const cells = parseInt(args[0]);
			// Convert cells to pixels using gridSize
			const distancePx = cells * config.gridSize;
			const rad = (angle * Math.PI) / 180;
			x += distancePx * Math.sin(rad);
			y -= distancePx * Math.cos(rad);
		} else if (op === 'turn') {
			angle = (angle + parseInt(args[0])) % 360;
			if (angle < 0) angle += 360;
		} else if (op === 'penDown') {
			penDown = true;
		} else if (op === 'penUp') {
			penDown = false;
		}
	}

	return { x, y, angle, penDown };
}


export function gradeTurtle(
	commandLog: string[],
	tests: TurtleTest[],
	config: CanvasConfig = DEFAULT_CANVAS_CONFIG
): GradeResult {
	const results: GradeResult['tests'] = [];
	let passed = 0;


	for (const test of tests) {
		let testPassed = false;
		let message = '';

		if (test.type === 'target' && test.expected.target) {
			const state = simulateTurtle(commandLog, config);
			const dx = Math.abs(state.x - test.expected.target.x);
			const dy = Math.abs(state.y - test.expected.target.y);
			const distance = Math.sqrt(dx * dx + dy * dy);
			const tolerance = test.expected.target.tolerance ?? 10;
			testPassed = distance <= tolerance;

			message = testPassed
				? `Turtle reached the target!`
				: `Turtle is ${distance.toFixed(1)} away from target.`;
		} else if (test.type === 'commands' && test.expected.commands) {
			testPassed = JSON.stringify(commandLog) === JSON.stringify(test.expected.commands);
			message = testPassed
				? `Turtle executed the correct commands.`
				: `Turtle executed the wrong commands.`;
		} else if (test.type === 'state' && test.expected.state) {
			const state = simulateTurtle(commandLog, config);
			const dx = Math.abs(state.x - test.expected.state.x);
			const dy = Math.abs(state.y - test.expected.state.y);
			const distance = Math.sqrt(dx * dx + dy * dy);
			const angleDiff = Math.abs(state.angle - test.expected.state.angle);
			testPassed = distance <= test.expected.state.tolerance && angleDiff <= test.expected.state.tolerance;
			message = testPassed
				? `Turtle reached the target state.`
				: `Turtle is ${distance.toFixed(1)} away from target state.`;
		}

		if (testPassed) passed++;

		results.push({
			...test,
			passed: testPassed,
			message
		});
	}
	return {
		passed: passed === tests.length,
		score: tests.length > 0 ? passed / tests.length : 0,
		tests: results
	};
}
