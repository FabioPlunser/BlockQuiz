import type { Point } from './types';
import { cellKey, pointsToCellSet } from './grid';

export interface CollisionInput {
	from: Point;
	to: Point;
	walls: readonly Point[];
	gridSize: number;
}

export type CollisionResult =
	| { hit: false; stop: Point }
	| { hit: true; stop: Point; cellCol: number; cellRow: number };

/**
 * Walk a segment from `from` to `to` in small sub-steps; if we enter a wall
 * cell, back off to the last safe sub-step and report a hit. This is the
 * "supercover-lite" approach: simple, predictable, and fast enough at the
 * canvas resolutions we care about.
 *
 * Sub-step size is `gridSize / 4` (pixels). That's tight enough to never miss
 * a wall cell yet large enough to keep a 400px traversal under ~30 iterations.
 */
export function traceCollision(input: CollisionInput): CollisionResult {
	const { from, to, walls, gridSize } = input;
	const size = Math.max(1, gridSize);
	const wallCells = pointsToCellSet(walls, size);

	if (wallCells.size === 0) return { hit: false, stop: to };

	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const length = Math.hypot(dx, dy);
	if (length === 0) return { hit: false, stop: to };

	const stepLength = size / 4;
	const steps = Math.max(1, Math.ceil(length / stepLength));
	const ux = dx / steps;
	const uy = dy / steps;

	let safe: Point = { x: from.x, y: from.y };
	for (let i = 1; i <= steps; i++) {
		const candidate: Point = { x: from.x + ux * i, y: from.y + uy * i };
		const col = Math.floor(candidate.x / size);
		const row = Math.floor(candidate.y / size);
		if (wallCells.has(cellKey({ col, row }))) {
			return { hit: true, stop: safe, cellCol: col, cellRow: row };
		}
		safe = candidate;
	}

	return { hit: false, stop: to };
}
