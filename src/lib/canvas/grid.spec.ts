import { describe, expect, it } from 'vitest';
import {
	cellKey,
	cellOf,
	dedupePointsByCell,
	gridDimensions,
	pointsToCellSet
} from './grid';

describe('cellOf', () => {
	it('places a point in the expected cell', () => {
		expect(cellOf({ x: 23, y: 47 }, 10)).toEqual({ col: 2, row: 4 });
	});

	it('floors at the cell boundary (right/bottom edge belongs to the next cell)', () => {
		expect(cellOf({ x: 10, y: 10 }, 10)).toEqual({ col: 1, row: 1 });
	});

	it('treats gridSize <= 0 as 1 to avoid divide-by-zero', () => {
		expect(cellOf({ x: 5, y: 7 }, 0)).toEqual({ col: 5, row: 7 });
		expect(cellOf({ x: 5, y: 7 }, -3)).toEqual({ col: 5, row: 7 });
	});

	it('handles negative coordinates by snapping to negative cells', () => {
		expect(cellOf({ x: -1, y: -5 }, 10)).toEqual({ col: -1, row: -1 });
	});
});

describe('cellKey', () => {
	it('serialises a cell to a comma-separated string', () => {
		expect(cellKey({ col: 3, row: 7 })).toBe('3,7');
	});
});

describe('pointsToCellSet', () => {
	it('produces unique keys per cell, regardless of duplicates inside the same cell', () => {
		const set = pointsToCellSet(
			[
				{ x: 5, y: 5 },
				{ x: 7, y: 8 }, // same cell as (5,5)
				{ x: 25, y: 5 } // different cell
			],
			10
		);
		expect(set.size).toBe(2);
		expect(set.has('0,0')).toBe(true);
		expect(set.has('2,0')).toBe(true);
	});

	it('returns an empty set for an empty input', () => {
		expect(pointsToCellSet([], 10).size).toBe(0);
	});
});

describe('dedupePointsByCell', () => {
	it('keeps the first occurrence within a cell and drops later duplicates', () => {
		const out = dedupePointsByCell(
			[
				{ x: 5, y: 5 },
				{ x: 9, y: 9 },
				{ x: 25, y: 5 }
			],
			10
		);
		expect(out).toHaveLength(2);
		expect(out[0]).toEqual({ x: 5, y: 5 });
		expect(out[1]).toEqual({ x: 25, y: 5 });
	});

	it('is a no-op when every point is in a distinct cell', () => {
		const points = [
			{ x: 5, y: 5 },
			{ x: 25, y: 5 },
			{ x: 5, y: 25 }
		];
		expect(dedupePointsByCell(points, 10)).toEqual(points);
	});
});

describe('gridDimensions', () => {
	it('floors against the grid size', () => {
		expect(gridDimensions(400, 300, 50)).toEqual({ cols: 8, rows: 6 });
	});

	it('clamps gridSize at 1 for non-positive values', () => {
		expect(gridDimensions(10, 10, 0)).toEqual({ cols: 10, rows: 10 });
	});
});
