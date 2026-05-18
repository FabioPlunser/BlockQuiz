import type { Point } from './types';
import { cellKey, cellOf, gridDimensions, pointsToCellSet, type Cell } from './grid';

export type ReachabilityResult =
	| { ok: true }
	| {
			ok: false;
			reason: 'no-start' | 'no-finish' | 'start-on-wall' | 'finish-on-wall' | 'unreachable';
	  };

export interface ReachabilityInput {
	width: number;
	height: number;
	gridSize: number;
	walls: readonly Point[];
	start: Point | null | undefined;
	finish: Point | null | undefined;
}

const NEIGHBOURS: ReadonlyArray<[number, number]> = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1]
];

/**
 * BFS over a discretized grid. Returns `ok: true` iff a 4-neighbour path exists
 * from the cell containing `start` to the cell containing `finish`, avoiding
 * cells that contain a wall.
 *
 * Pure and synchronous — safe to call from publish-validation and from the
 * editor's live "is this still solvable?" indicator.
 */
export function checkReachability(input: ReachabilityInput): ReachabilityResult {
	const { width, height, gridSize, walls, start, finish } = input;

	if (!start) return { ok: false, reason: 'no-start' };
	if (!finish) return { ok: false, reason: 'no-finish' };

	const wallSet = pointsToCellSet(walls, gridSize);
	const startCell = cellOf(start, gridSize);
	const finishCell = cellOf(finish, gridSize);

	if (wallSet.has(cellKey(startCell))) return { ok: false, reason: 'start-on-wall' };
	if (wallSet.has(cellKey(finishCell))) return { ok: false, reason: 'finish-on-wall' };

	if (cellKey(startCell) === cellKey(finishCell)) return { ok: true };

	const { cols, rows } = gridDimensions(width, height, gridSize);
	const visited = new Set<string>([cellKey(startCell)]);
	const queue: Cell[] = [startCell];

	while (queue.length > 0) {
		const current = queue.shift() as Cell;
		for (const [dc, dr] of NEIGHBOURS) {
			const next: Cell = { col: current.col + dc, row: current.row + dr };
			if (next.col < 0 || next.row < 0 || next.col >= cols || next.row >= rows) continue;
			const key = cellKey(next);
			if (visited.has(key) || wallSet.has(key)) continue;
			if (key === cellKey(finishCell)) return { ok: true };
			visited.add(key);
			queue.push(next);
		}
	}

	return { ok: false, reason: 'unreachable' };
}

/**
 * Returns the shortest 4-neighbour path from start to finish as pixel
 * waypoints (cell centers), or `null` if no path exists. The first and last
 * waypoints snap to the start/finish cells. Used by the editor's
 * "Generate path" affordance.
 */
export function findShortestPath(input: ReachabilityInput): Point[] | null {
	const { width, height, gridSize, walls, start, finish } = input;
	if (!start || !finish) return null;

	const wallSet = pointsToCellSet(walls, gridSize);
	const startCell = cellOf(start, gridSize);
	const finishCell = cellOf(finish, gridSize);
	if (wallSet.has(cellKey(startCell)) || wallSet.has(cellKey(finishCell))) return null;

	const { cols, rows } = gridDimensions(width, height, gridSize);
	const parent = new Map<string, string | null>();
	parent.set(cellKey(startCell), null);
	const queue: Cell[] = [startCell];

	let found = false;
	while (queue.length > 0) {
		const current = queue.shift() as Cell;
		if (cellKey(current) === cellKey(finishCell)) {
			found = true;
			break;
		}
		for (const [dc, dr] of NEIGHBOURS) {
			const next: Cell = { col: current.col + dc, row: current.row + dr };
			if (next.col < 0 || next.row < 0 || next.col >= cols || next.row >= rows) continue;
			const key = cellKey(next);
			if (parent.has(key) || wallSet.has(key)) continue;
			parent.set(key, cellKey(current));
			queue.push(next);
		}
	}

	if (!found) return null;

	// Walk parents back to the start, then reverse.
	const size = Math.max(1, gridSize);
	const cellCenter = (key: string): Point => {
		const [col, row] = key.split(',').map(Number);
		return { x: col * size + size / 2, y: row * size + size / 2 };
	};

	const path: Point[] = [];
	let cursor: string | null = cellKey(finishCell);
	while (cursor) {
		path.unshift(cellCenter(cursor));
		cursor = parent.get(cursor) ?? null;
	}
	return path;
}
