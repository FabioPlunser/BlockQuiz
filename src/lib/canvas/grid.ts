import type { Point } from './types';

/**
 * Grid cell coordinate. Cells are zero-indexed; (0,0) is the top-left cell.
 */
export interface Cell {
	col: number;
	row: number;
}

/** Discretize a pixel point to its containing grid cell. */
export function cellOf(point: Point, gridSize: number): Cell {
	const size = Math.max(1, gridSize);
	return { col: Math.floor(point.x / size), row: Math.floor(point.y / size) };
}

/** Stable string key for use in Set / Map, e.g. "3,7". */
export function cellKey(cell: Cell): string {
	return `${cell.col},${cell.row}`;
}

/** Build a Set of cell keys from an array of pixel points. */
export function pointsToCellSet(points: readonly Point[], gridSize: number): Set<string> {
	const out = new Set<string>();
	for (const p of points) out.add(cellKey(cellOf(p, gridSize)));
	return out;
}

/**
 * Drop duplicate points that fall in the same cell. Keeps the first occurrence.
 * Used in the editor so two clicks in the same cell don't create stacked walls.
 */
export function dedupePointsByCell<T extends Point>(points: readonly T[], gridSize: number): T[] {
	const seen = new Set<string>();
	const out: T[] = [];
	for (const p of points) {
		const key = cellKey(cellOf(p, gridSize));
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(p);
	}
	return out;
}

/** Grid dimensions for a canvas of `width × height` pixels at `gridSize`. */
export function gridDimensions(width: number, height: number, gridSize: number) {
	const size = Math.max(1, gridSize);
	return { cols: Math.floor(width / size), rows: Math.floor(height / size) };
}
