import type { BlockDef } from '$lib/blockly/types';

export interface Point {
	x: number;
	y: number;
}

export interface Command {
	type: string;
	args: string[] | number[];
	timestamp: number;
}

export interface Canvas2DState {
	x: number;
	y: number;
	angle: number;
}

export interface TurtleSate extends Canvas2DState {
	tolerance: number;
	penDown: boolean;
	color: string;
}

export interface PathOverlay {
	points: Point[];
	color?: string;
	width?: number;
}

export interface TargetPoint {
	x: number;
	y: number;
	tolerance?: number;
}

export interface ComparisonResult {
	score: number;
	passed: boolean;
	details: {
		positionMatch: boolean;
		angleMatch: boolean;
		distance: number;
	};
}

export interface PathSegment {
	from: Point;
	to: Point;
	color?: string;
	width?: number;
}

export interface ICanvas2D {
	readonly width: number;
	readonly height: number;
	readonly state: Canvas2DState;
	readonly commands: Command[];
	blockDefs: BlockDef[];

	move(distance: number): void;
	turn(degrees: number): void;
	setPenDown(): void;
	setPenUp(): void;
	setColor(hex: string): void;
	reset(): void;

	get State(): Canvas2DState;
	get Log(): Command[];
	get api(): {
		move: (d: number) => void;
		turn: (d: number) => void;
		penUp: () => void;
		penDown: () => void;
		color: (c: string) => void;
		reset: () => void;
	};
}
