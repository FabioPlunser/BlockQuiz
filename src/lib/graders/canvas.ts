import type { Point } from '$lib/canvas/types';

/**
 * Convert a canvas point (pixels) into integer grid coordinates using the given cell size.
 */
export function toGridCell(point: Point, cellSize: number): { col: number; row: number } {
  const col = Math.round(point.x / cellSize);
  const row = Math.round(point.y / cellSize);
  return { col, row };
}

/**
 * Normalize a list of points into grid cells and remove consecutive duplicates.
 * This is useful for comparing teacher and student paths.
 */
export function normalizePathToCells(points: Point[], cellSize: number): { col: number; row: number }[] {
  const cells = points.map((p) => toGridCell(p, cellSize));
  return cells.filter(
    (c, i) => i === 0 || c.col !== cells[i - 1].col || c.row !== cells[i - 1].row
  );
}

/**
 * Compare two paths encoded as grid cells for exact equality in length and sequence.
 */
export function pathsEqual(
  teacherCells: { col: number; row: number }[],
  studentCells: { col: number; row: number }[]
): boolean {
  if (teacherCells.length !== studentCells.length || teacherCells.length === 0) return false;
  return studentCells.every((c, i) => c.col === teacherCells[i].col && c.row === teacherCells[i].row);
}

/**
 * Check if a grid cell is within a given tolerance (in cells) of another cell.
 */
export function cellDistanceWithinTolerance(
  a: { col: number; row: number },
  b: { col: number; row: number },
  tolerance: number
): boolean {
  const dist = Math.hypot(a.col - b.col, a.row - b.row);
  return dist <= tolerance;
}

/**
 * Given canvas-space turtle position, walls and apple, compute simple grading info.
 */
export function evaluateTurtlePositionOnGrid(params: {
  turtle: Point;
  walls: Point[];
  apple: Point | null;
  cellSize: number;
  appleToleranceCells: number;
  wallToleranceCells: number;
}): { wallHit: boolean; atApple: boolean } {
  const { turtle, walls, apple, cellSize, appleToleranceCells, wallToleranceCells } = params;

  const turtleCell = toGridCell(turtle, cellSize);

  const wallHit = walls.some((w) =>
    cellDistanceWithinTolerance(turtleCell, toGridCell(w, cellSize), wallToleranceCells)
  );

  let atApple = false;
  if (apple) {
    atApple = cellDistanceWithinTolerance(
      turtleCell,
      toGridCell(apple, cellSize),
      appleToleranceCells
    );
  }

  return { wallHit, atApple };
}



