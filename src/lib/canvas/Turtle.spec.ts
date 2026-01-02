import { describe, it, expect, beforeEach } from 'vitest';
import { Turtle } from './Turtle.svelte';

describe('Turtle', () => {
	let turtle: Turtle;

	beforeEach(() => {
		turtle = new Turtle(400, 400);
	});

	describe('initialization', () => {
		it('should initialize with correct dimensions', () => {
			expect(turtle.width).toBe(400);
			expect(turtle.height).toBe(400);
		});

		it('should start at center', () => {
			expect(turtle.state.x).toBe(200);
			expect(turtle.state.y).toBe(200);
		});

		it('should start with pen up', () => {
			expect(turtle.pen).toBe(false);
		});

		it('should start with black color', () => {
			expect(turtle.color).toBe('#000000');
		});

		it('should have empty path initially', () => {
			expect(turtle.path).toHaveLength(0);
		});
	});

	describe('pen control', () => {
		it('should set pen down', () => {
			turtle.penDown();
			expect(turtle.pen).toBe(true);
		});

		it('should set pen up', () => {
			turtle.penDown();
			turtle.penUp();
			expect(turtle.pen).toBe(false);
		});

		it('should log penDown command', () => {
			turtle.penDown();
			expect(turtle.commands.some((c) => c.type === 'penDown')).toBe(true);
		});

		it('should log penUp command', () => {
			turtle.penUp();
			expect(turtle.commands.some((c) => c.type === 'penUp')).toBe(true);
		});

		it('should set pen via setPen method', () => {
			turtle.setPen('down');
			expect(turtle.pen).toBe(true);
			turtle.setPen('up');
			expect(turtle.pen).toBe(false);
		});
	});

	describe('color', () => {
		it('should set color', () => {
			turtle.setColor('#ff0000');
			expect(turtle.color).toBe('#ff0000');
		});

		it('should log color command', () => {
			turtle.setColor('#00ff00');
			expect(turtle.commands.some((c) => c.type === 'color')).toBe(true);
		});
	});

	describe('path tracking', () => {
		it('should not add path segment when pen is up', () => {
			turtle.move(1);
			expect(turtle.path).toHaveLength(0);
		});

		it('should add path segment when pen is down', () => {
			turtle.penDown();
			turtle.move(1);
			expect(turtle.path).toHaveLength(1);
		});

		it('should record correct path segment', () => {
			turtle.penDown();
			turtle.move(1);
			
			const segment = turtle.path[0];
			expect(segment.from).toEqual({ x: 200, y: 200 });
			expect(segment.to.x).toBeCloseTo(200, 5);
			expect(segment.to.y).toBeCloseTo(150, 5);
		});

		it('should record path color', () => {
			turtle.penDown();
			turtle.setColor('#ff0000');
			turtle.move(1);
			
			expect(turtle.path[0].color).toBe('#ff0000');
		});

		it('should track multiple segments', () => {
			turtle.penDown();
			turtle.move(1);
			turtle.turn(90);
			turtle.move(1);
			
			expect(turtle.path).toHaveLength(2);
		});
	});

	describe('reset', () => {
		it('should reset position to center', () => {
			turtle.move(2);
			turtle.turn(90);
			turtle.reset();
			
			expect(turtle.state.x).toBe(200);
			expect(turtle.state.y).toBe(200);
			expect(turtle.state.angle).toBe(0);
		});

		it('should clear path', () => {
			turtle.penDown();
			turtle.move(1);
			turtle.reset();
			
			expect(turtle.path).toHaveLength(0);
		});

		it('should reset pen to up', () => {
			turtle.penDown();
			turtle.reset();
			
			expect(turtle.pen).toBe(false);
		});

		it('should reset color to black', () => {
			turtle.setColor('#ff0000');
			turtle.reset();
			
			expect(turtle.color).toBe('#000000');
		});

		it('should clear commands', () => {
			turtle.move(1);
			turtle.penDown();
			turtle.reset();
			
			expect(turtle.commands).toHaveLength(0);
		});
	});

	describe('api', () => {
		it('should expose penUp via api', () => {
			turtle.api.penDown();
			turtle.api.penUp();
			expect(turtle.pen).toBe(false);
		});

		it('should expose penDown via api', () => {
			turtle.api.penDown();
			expect(turtle.pen).toBe(true);
		});

		it('should expose color via api', () => {
			turtle.api.color('#0000ff');
			expect(turtle.color).toBe('#0000ff');
		});

		it('should expose setPen via api', () => {
			turtle.api.setPen('down');
			expect(turtle.pen).toBe(true);
		});
	});

	describe('blockDefs', () => {
		it('should include Canvas2D blocks', () => {
			const ids = turtle.blockDefs.map((b) => b.id);
			expect(ids).toContain('move');
			expect(ids).toContain('turn');
		});

		it('should include Turtle-specific blocks', () => {
			const ids = turtle.blockDefs.map((b) => b.id);
			expect(ids).toContain('pen');
			expect(ids).toContain('color');
		});
	});

	describe('engineId', () => {
		it('should have turtle engineId', () => {
			expect(turtle.engineId).toBe('turtle');
		});
	});

	describe('path getter', () => {
		it('should return path array via getter', () => {
			expect(Array.isArray(turtle.path)).toBe(true);
			expect(turtle.path).toHaveLength(0);
		});

		it('should update path when pen is down and moving', () => {
			turtle.penDown();
			turtle.move(1);
			expect(turtle.path).toHaveLength(1);
		});
	});

	describe('ICanvasEngine interface', () => {
		it('should implement ICanvasEngine', () => {
			expect(turtle).toHaveProperty('width');
			expect(turtle).toHaveProperty('height');
			expect(turtle).toHaveProperty('gridSize');
			expect(turtle).toHaveProperty('commands');
			expect(turtle).toHaveProperty('blockDefs');
			expect(turtle).toHaveProperty('api');
			expect(turtle).toHaveProperty('path');
			expect(turtle).toHaveProperty('reset');
		});
	});

	describe('integration', () => {
		it('should draw a square', () => {
			turtle.penDown();
			
			for (let i = 0; i < 4; i++) {
				turtle.move(1);
				turtle.turn(90);
			}
			
			expect(turtle.path).toHaveLength(4);
			// Should end at starting position
			expect(turtle.state.x).toBeCloseTo(200, 4);
			expect(turtle.state.y).toBeCloseTo(200, 4);
		});

		it('should handle complex path with color changes', () => {
			turtle.penDown();
			turtle.setColor('#ff0000');
			turtle.move(1);
			turtle.setColor('#00ff00');
			turtle.move(1);
			
			expect(turtle.path[0].color).toBe('#ff0000');
			expect(turtle.path[1].color).toBe('#00ff00');
		});
	});
});

