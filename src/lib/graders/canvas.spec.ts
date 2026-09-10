import { describe, it, expect } from 'vitest';
import {
	toGridCell,
	normalizePathToCells,
	pathsEqual,
	cellDistanceWithinTolerance,
	evaluateTurtlePositionOnGrid
} from './canvas';

describe('toGridCell', () => {
	it('should convert pixel coordinates to grid cell', () => {
		const cell = toGridCell({ x: 100, y: 150 }, 50);
		expect(cell.col).toBe(2);
		expect(cell.row).toBe(3);
	});

	it('should round to nearest cell', () => {
		const cell = toGridCell({ x: 124, y: 176 }, 50);
		expect(cell.col).toBe(2); // 124/50 = 2.48 -> 2
		expect(cell.row).toBe(4); // 176/50 = 3.52 -> 4
	});

	it('should handle origin', () => {
		const cell = toGridCell({ x: 0, y: 0 }, 50);
		expect(cell.col).toBe(0);
		expect(cell.row).toBe(0);
	});

	it('should handle exact cell boundaries', () => {
		const cell = toGridCell({ x: 50, y: 100 }, 50);
		expect(cell.col).toBe(1);
		expect(cell.row).toBe(2);
	});
});

describe('normalizePathToCells', () => {
	it('should convert path points to grid cells', () => {
		const points = [
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
			{ x: 100, y: 0 }
		];
		const cells = normalizePathToCells(points, 50);
		expect(cells).toEqual([
			{ col: 0, row: 0 },
			{ col: 1, row: 0 },
			{ col: 2, row: 0 }
		]);
	});

	it('should remove consecutive duplicates', () => {
		const points = [
			{ x: 0, y: 0 },
			{ x: 10, y: 10 }, // rounds to same cell as above
			{ x: 50, y: 0 }
		];
		const cells = normalizePathToCells(points, 50);
		expect(cells).toEqual([
			{ col: 0, row: 0 },
			{ col: 1, row: 0 }
		]);
	});

	it('should handle empty path', () => {
		const cells = normalizePathToCells([], 50);
		expect(cells).toEqual([]);
	});

	it('should handle single point', () => {
		const cells = normalizePathToCells([{ x: 100, y: 100 }], 50);
		expect(cells).toEqual([{ col: 2, row: 2 }]);
	});
});

describe('pathsEqual', () => {
	it('should return true for identical paths', () => {
		const path1 = [
			{ col: 0, row: 0 },
			{ col: 1, row: 0 },
			{ col: 1, row: 1 }
		];
		const path2 = [
			{ col: 0, row: 0 },
			{ col: 1, row: 0 },
			{ col: 1, row: 1 }
		];
		expect(pathsEqual(path1, path2)).toBe(true);
	});

	it('should return false for different lengths', () => {
		const path1 = [
			{ col: 0, row: 0 },
			{ col: 1, row: 0 }
		];
		const path2 = [{ col: 0, row: 0 }];
		expect(pathsEqual(path1, path2)).toBe(false);
	});

	it('should return false for different cells', () => {
		const path1 = [
			{ col: 0, row: 0 },
			{ col: 1, row: 0 }
		];
		const path2 = [
			{ col: 0, row: 0 },
			{ col: 2, row: 0 }
		];
		expect(pathsEqual(path1, path2)).toBe(false);
	});

	it('should return false for empty paths', () => {
		expect(pathsEqual([], [])).toBe(false);
	});
});

describe('cellDistanceWithinTolerance', () => {
	it('should return true for same cell', () => {
		const result = cellDistanceWithinTolerance({ col: 1, row: 1 }, { col: 1, row: 1 }, 0);
		expect(result).toBe(true);
	});

	it('should return true for adjacent cell within tolerance', () => {
		const result = cellDistanceWithinTolerance({ col: 1, row: 1 }, { col: 2, row: 1 }, 1);
		expect(result).toBe(true);
	});

	it('should return false for cell outside tolerance', () => {
		const result = cellDistanceWithinTolerance({ col: 1, row: 1 }, { col: 3, row: 1 }, 1);
		expect(result).toBe(false);
	});

	it('should handle diagonal distance', () => {
		// Diagonal distance is sqrt(2) ≈ 1.414
		const result = cellDistanceWithinTolerance({ col: 0, row: 0 }, { col: 1, row: 1 }, 1.5);
		expect(result).toBe(true);
	});
});

describe('evaluateTurtlePositionOnGrid', () => {
	const cellSize = 50;

	it('should detect when turtle is at apple', () => {
		const result = evaluateTurtlePositionOnGrid({
			turtle: { x: 100, y: 100 },
			walls: [],
			apple: { x: 100, y: 100 },
			cellSize,
			appleToleranceCells: 0.5,
			wallToleranceCells: 0
		});
		expect(result.atApple).toBe(true);
		expect(result.wallHit).toBe(false);
	});

	it('should detect when turtle hits wall', () => {
		const result = evaluateTurtlePositionOnGrid({
			turtle: { x: 100, y: 100 },
			walls: [{ x: 100, y: 100 }],
			apple: null,
			cellSize,
			appleToleranceCells: 0.5,
			wallToleranceCells: 0
		});
		expect(result.wallHit).toBe(true);
		expect(result.atApple).toBe(false);
	});

	it('should return false for both when no collision', () => {
		const result = evaluateTurtlePositionOnGrid({
			turtle: { x: 100, y: 100 },
			walls: [{ x: 200, y: 200 }],
			apple: { x: 300, y: 300 },
			cellSize,
			appleToleranceCells: 0.5,
			wallToleranceCells: 0
		});
		expect(result.atApple).toBe(false);
		expect(result.wallHit).toBe(false);
	});

	it('should use tolerance for apple detection', () => {
		// Apple at (100, 100) = cell (2, 2)
		// Turtle at (125, 100) = cell (2.5, 2) rounds to (3, 2)
		// Distance is 1 cell, tolerance is 1.5
		const result = evaluateTurtlePositionOnGrid({
			turtle: { x: 125, y: 100 },
			walls: [],
			apple: { x: 100, y: 100 },
			cellSize,
			appleToleranceCells: 1.5,
			wallToleranceCells: 0
		});
		expect(result.atApple).toBe(true);
	});

	it('should handle multiple walls', () => {
		const result = evaluateTurtlePositionOnGrid({
			turtle: { x: 150, y: 150 },
			walls: [
				{ x: 50, y: 50 },
				{ x: 150, y: 150 },
				{ x: 250, y: 250 }
			],
			apple: null,
			cellSize,
			appleToleranceCells: 0.5,
			wallToleranceCells: 0
		});
		expect(result.wallHit).toBe(true);
	});

	it('should handle null apple', () => {
		const result = evaluateTurtlePositionOnGrid({
			turtle: { x: 100, y: 100 },
			walls: [],
			apple: null,
			cellSize,
			appleToleranceCells: 0.5,
			wallToleranceCells: 0
		});
		expect(result.atApple).toBe(false);
	});
});
