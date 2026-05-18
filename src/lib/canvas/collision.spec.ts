import { describe, expect, it } from 'vitest';
import { traceCollision } from './collision';

const GRID = 10;

describe('traceCollision', () => {
	it('passes through with no walls', () => {
		const result = traceCollision({
			from: { x: 0, y: 0 },
			to: { x: 50, y: 0 },
			walls: [],
			gridSize: GRID
		});
		expect(result.hit).toBe(false);
		expect(result.stop).toEqual({ x: 50, y: 0 });
	});

	it('passes through when no wall lies on the segment', () => {
		const result = traceCollision({
			from: { x: 5, y: 5 },
			to: { x: 25, y: 5 },
			walls: [{ x: 55, y: 55 }],
			gridSize: GRID
		});
		expect(result.hit).toBe(false);
		expect(result.stop).toEqual({ x: 25, y: 5 });
	});

	it('stops at the last safe pixel when it hits a wall cell', () => {
		// Wall at cell (2,0) covers x in [20,30); start in cell (0,0), end in cell (3,0).
		const result = traceCollision({
			from: { x: 5, y: 5 },
			to: { x: 35, y: 5 },
			walls: [{ x: 25, y: 5 }],
			gridSize: GRID
		});
		expect(result.hit).toBe(true);
		if (result.hit) {
			expect(result.stop.x).toBeLessThan(20);
			expect(result.cellCol).toBe(2);
			expect(result.cellRow).toBe(0);
		}
	});

	it('zero-length segment is a no-op', () => {
		const result = traceCollision({
			from: { x: 12, y: 12 },
			to: { x: 12, y: 12 },
			walls: [{ x: 55, y: 55 }],
			gridSize: GRID
		});
		expect(result.hit).toBe(false);
		expect(result.stop).toEqual({ x: 12, y: 12 });
	});

	it('reports a hit even on a short segment when the destination cell is a wall', () => {
		const result = traceCollision({
			from: { x: 5, y: 5 },
			to: { x: 15, y: 5 },
			walls: [{ x: 15, y: 5 }],
			gridSize: GRID
		});
		expect(result.hit).toBe(true);
	});
});
