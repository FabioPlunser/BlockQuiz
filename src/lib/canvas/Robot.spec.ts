import { describe, expect, it } from 'vitest';
import { Robot } from './Robot.svelte';

describe('Robot', () => {
	it('starts and resets from the configured grid state', () => {
		expect.assertions(5);

		const robot = new Robot(400, 400, {
			start: { x: 50, y: 150 },
			direction: 'east'
		});
		robot.gridSize = 50;

		expect(robot.state).toEqual({ x: 50, y: 150, angle: 90 });

		robot.move(2);
		expect(robot.state.x).toBe(150);
		expect(robot.state.y).toBe(150);
		expect(robot.commands).toHaveLength(1);

		robot.reset();
		expect(robot.state).toEqual({ x: 50, y: 150, angle: 90 });
	});
});
