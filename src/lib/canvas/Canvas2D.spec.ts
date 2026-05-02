import { describe, it, expect, beforeEach } from 'vitest';
import { Canvas2D } from './Canvas2D.svelte';

describe('Canvas2D', () => {
	let canvas: Canvas2D;

	beforeEach(() => {
		canvas = new Canvas2D(400, 400);
	});

	describe('initialization', () => {
		it('should initialize with correct dimensions', () => {
			expect(canvas.width).toBe(400);
			expect(canvas.height).toBe(400);
		});

		it('should start at center', () => {
			expect(canvas.state.x).toBe(200);
			expect(canvas.state.y).toBe(200);
		});

		it('should start with angle 0', () => {
			expect(canvas.state.angle).toBe(0);
		});

		it('should have default grid size of 50', () => {
			expect(canvas.gridSize).toBe(50);
		});

		it('should have empty commands initially', () => {
			expect(canvas.commands).toHaveLength(0);
		});
	});

	describe('move', () => {
		it('should move forward (north) at angle 0', () => {
			canvas.move(1); // 1 cell = 50px
			expect(canvas.state.x).toBeCloseTo(200, 5);
			expect(canvas.state.y).toBeCloseTo(150, 5);
		});

		it('should move east at angle 90', () => {
			canvas.turn(90);
			canvas.move(1);
			expect(canvas.state.x).toBeCloseTo(250, 5);
			expect(canvas.state.y).toBeCloseTo(200, 5);
		});

		it('should move south at angle 180', () => {
			canvas.turn(180);
			canvas.move(1);
			expect(canvas.state.x).toBeCloseTo(200, 5);
			expect(canvas.state.y).toBeCloseTo(250, 5);
		});

		it('should move west at angle 270', () => {
			canvas.turn(270);
			canvas.move(1);
			expect(canvas.state.x).toBeCloseTo(150, 5);
			expect(canvas.state.y).toBeCloseTo(200, 5);
		});

		it('should log move command', () => {
			canvas.move(2);
			expect(canvas.commands).toHaveLength(1);
			expect(canvas.commands[0].type).toBe('move');
			expect(canvas.commands[0].args).toEqual(['2']);
		});
	});

	describe('turn', () => {
		it('should turn right', () => {
			canvas.turn(90);
			expect(canvas.state.angle).toBe(90);
		});

		it('should turn left', () => {
			canvas.turn(-90);
			expect(canvas.state.angle).toBe(270);
		});

		it('should wrap at 360', () => {
			canvas.turn(450);
			expect(canvas.state.angle).toBe(90);
		});

		it('should log turn command', () => {
			canvas.turn(45);
			expect(canvas.commands).toHaveLength(1);
			expect(canvas.commands[0].type).toBe('turn');
			expect(canvas.commands[0].args).toEqual(['45']);
		});
	});

	describe('reset', () => {
		it('should reset position to center', () => {
			canvas.move(2);
			canvas.turn(90);
			canvas.move(1);
			canvas.reset();

			expect(canvas.state.x).toBe(200);
			expect(canvas.state.y).toBe(200);
			expect(canvas.state.angle).toBe(0);
		});

		it('should clear commands', () => {
			canvas.move(1);
			canvas.turn(90);
			canvas.reset();

			expect(canvas.commands).toHaveLength(0);
		});
	});

	describe('api', () => {
		it('should expose move via api', () => {
			canvas.api.move(1);
			expect(canvas.state.y).toBeCloseTo(150, 5);
		});

		it('should expose turn via api', () => {
			canvas.api.turn(90);
			expect(canvas.state.angle).toBe(90);
		});

		it('should expose reset via api', () => {
			canvas.api.move(1);
			canvas.api.reset();
			expect(canvas.state.x).toBe(200);
			expect(canvas.state.y).toBe(200);
		});

		it('should log pen commands via api', () => {
			canvas.api.penDown();
			canvas.api.penUp();
			expect(canvas.commands).toHaveLength(2);
			expect(canvas.commands[0].type).toBe('pen');
			expect(canvas.commands[0].args).toEqual(['down']);
			expect(canvas.commands[1].type).toBe('pen');
			expect(canvas.commands[1].args).toEqual(['up']);
		});

		it('should log color commands via api', () => {
			canvas.api.color('#ff0000');
			expect(canvas.commands).toHaveLength(1);
			expect(canvas.commands[0].type).toBe('color');
			expect(canvas.commands[0].args).toEqual(['#ff0000']);
		});
	});

	describe('blockDefs', () => {
		it('should have move and turn blocks', () => {
			const ids = canvas.blockDefs.map((b) => b.id);
			expect(ids).toContain('move');
			expect(ids).toContain('turn');
		});
	});
});
