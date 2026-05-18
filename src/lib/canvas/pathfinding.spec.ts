import { describe, expect, it } from 'vitest';
import { checkReachability, findShortestPath } from './pathfinding';

const BASE = { width: 100, height: 100, gridSize: 10, walls: [] as { x: number; y: number }[] };

describe('checkReachability', () => {
	it('reports no-start when start is missing', () => {
		expect(
			checkReachability({ ...BASE, start: null, finish: { x: 50, y: 50 } })
		).toEqual({ ok: false, reason: 'no-start' });
	});

	it('reports no-finish when finish is missing', () => {
		expect(
			checkReachability({ ...BASE, start: { x: 5, y: 5 }, finish: null })
		).toEqual({ ok: false, reason: 'no-finish' });
	});

	it('reports start-on-wall when start sits in a wall cell', () => {
		expect(
			checkReachability({
				...BASE,
				walls: [{ x: 5, y: 5 }],
				start: { x: 8, y: 8 },
				finish: { x: 50, y: 50 }
			})
		).toEqual({ ok: false, reason: 'start-on-wall' });
	});

	it('reports finish-on-wall when finish sits in a wall cell', () => {
		expect(
			checkReachability({
				...BASE,
				walls: [{ x: 50, y: 50 }],
				start: { x: 5, y: 5 },
				finish: { x: 55, y: 55 }
			})
		).toEqual({ ok: false, reason: 'finish-on-wall' });
	});

	it('returns ok when start and finish are in the same cell', () => {
		expect(
			checkReachability({ ...BASE, start: { x: 5, y: 5 }, finish: { x: 9, y: 9 } })
		).toEqual({ ok: true });
	});

	it('reports unreachable when a wall column separates start from finish', () => {
		// 10x10 grid; wall column at col 5 from row 0..9
		const walls = Array.from({ length: 10 }, (_, row) => ({ x: 55, y: row * 10 + 5 }));
		expect(
			checkReachability({
				...BASE,
				walls,
				start: { x: 5, y: 5 },
				finish: { x: 95, y: 95 }
			})
		).toEqual({ ok: false, reason: 'unreachable' });
	});

	it('returns ok when a path exists around a partial wall', () => {
		const walls = Array.from({ length: 8 }, (_, row) => ({ x: 55, y: row * 10 + 5 }));
		expect(
			checkReachability({
				...BASE,
				walls,
				start: { x: 5, y: 5 },
				finish: { x: 95, y: 95 }
			})
		).toEqual({ ok: true });
	});
});

describe('findShortestPath', () => {
	it('returns null when start or finish is missing', () => {
		expect(
			findShortestPath({ ...BASE, start: null, finish: { x: 5, y: 5 } })
		).toBeNull();
	});

	it('returns null when the finish is unreachable', () => {
		const walls = Array.from({ length: 10 }, (_, row) => ({ x: 55, y: row * 10 + 5 }));
		expect(
			findShortestPath({
				...BASE,
				walls,
				start: { x: 5, y: 5 },
				finish: { x: 95, y: 95 }
			})
		).toBeNull();
	});

	it('produces a path of cell-center waypoints on an open board', () => {
		const path = findShortestPath({
			...BASE,
			start: { x: 5, y: 5 },
			finish: { x: 25, y: 5 }
		});
		expect(path).not.toBeNull();
		expect(path?.[0]).toEqual({ x: 5, y: 5 });
		expect(path?.[path.length - 1]).toEqual({ x: 25, y: 5 });
	});

	it('returns a single-cell path when start equals finish cell', () => {
		const path = findShortestPath({
			...BASE,
			start: { x: 5, y: 5 },
			finish: { x: 8, y: 8 }
		});
		expect(path).toEqual([{ x: 5, y: 5 }]);
	});
});
