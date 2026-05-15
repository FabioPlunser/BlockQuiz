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
