import type { Point, TargetPoint } from '$lib/canvas/types';
import type { TestCase } from '$lib/types/exercise';

/**
 * Build new target test cases from the canvas-drawn targets, preserving any
 * non-target tests that are already on the exercise.
 */
export function rebuildTargetTests(
	existingTests: TestCase[],
	targets: TargetPoint[],
	defaultTolerance: number
): TestCase[] {
	const nonTargetTests = existingTests.filter((t) => t.type !== 'target');
	const targetTests: TestCase[] = targets.map((target, index) => ({
		id: `target-${target.x}-${target.y}`,
		description: {
			de: `Erreiche Ziel bei (${target.x}, ${target.y})`,
			en: `Reach target at (${target.x}, ${target.y})`
		},
		visible: true,
		type: 'target' as const,
		message: {
			de: `Ziel ${index + 1} erreicht!`,
			en: `Target ${index + 1} reached!`
		},
		expected: {
			target: {
				x: target.x,
				y: target.y,
				tolerance: target.tolerance ?? defaultTolerance
			}
		}
	}));
	return [...nonTargetTests, ...targetTests];
}

/**
 * Build a path test from the canvas-drawn path overlay, preserving any
 * non-path tests. Returns the rebuilt list (with the path test removed if
 * fewer than 2 points are present).
 */
export function rebuildPathTest(existingTests: TestCase[], pathPoints: Point[]): TestCase[] {
	const nonPathTests = existingTests.filter((t) => t.type !== 'path');
	if (pathPoints.length <= 1) return nonPathTests;

	const pathTest: TestCase = {
		id: 'path-follow',
		description: {
			de: `Folge dem gezeichneten Pfad (${pathPoints.length} Punkte)`,
			en: `Follow the drawn path (${pathPoints.length} points)`
		},
		visible: true,
		type: 'path' as const,
		message: {
			de: 'Pfad erfolgreich verfolgt!',
			en: 'Path followed successfully!'
		},
		expected: {
			path: pathPoints.map((p) => ({ x: p.x, y: p.y }))
		}
	};
	return [...nonPathTests, pathTest];
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function clampInteger(value: number, min: number, max: number): number {
	return Math.round(clamp(value, min, max));
}

export function parseNumberInput(event: Event, fallback: number): number {
	const value = Number((event.currentTarget as HTMLInputElement).value);
	return Number.isFinite(value) ? value : fallback;
}
