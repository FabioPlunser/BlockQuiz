import type { BlockDef } from '$lib/blockly/types';

// =============================================================================
// Core Types
// =============================================================================

export interface Point {
	x: number;
	y: number;
}

export interface Command {
	type: string;
	args: Array<string | number>;
	timestamp: number;
}

export interface PathSegment {
	from: Point;
	to: Point;
	color?: string;
	width?: number;
}

// =============================================================================
// Engine Interface - Base contract all canvas engines must implement
// =============================================================================

/**
 * Base interface for any 2D canvas engine.
 * Engines like Turtle, Robot, Dino, GeometryDash all implement this.
 */
export interface ICanvasEngine {
	readonly width: number;
	readonly height: number;
	readonly gridSize: number;
	readonly commands: Command[];
	blockDefs: BlockDef[];

	reset(): void;
	get api(): Record<string, (...args: any[]) => void>;

	// Optional: engines can provide path segments for trail rendering
	readonly path?: PathSegment[];
}

/**
 * Extended interface for position-based engines (Turtle, Robot).
 * These have x/y/angle state and move/turn commands.
 */
export interface IPositionEngine extends ICanvasEngine {
	readonly state: PositionState;
	move(distance: number): void;
	turn(degrees: number): void;
}

export interface PositionState {
	x: number;
	y: number;
	angle: number;
}

/**
 * Extended interface for side-scrolling engines (Dino, GeometryDash).
 * These have position + velocity and jump/duck commands.
 */
export interface ISideScrollEngine extends ICanvasEngine {
	readonly state: SideScrollState;
	jump(): void;
	duck?(): void;
}

export interface SideScrollState {
	x: number;
	y: number;
	velocityY: number;
	isJumping: boolean;
	isDucking?: boolean;
}

// =============================================================================
// Legacy Canvas2D interface (for backward compatibility)
// =============================================================================

export interface Canvas2DState extends PositionState {}

export interface TurtleState extends Canvas2DState {
	tolerance: number;
	penDown: boolean;
	color: string;
}

/** @deprecated Use IPositionEngine instead */
export interface ICanvas2D extends IPositionEngine {
	setPenDown(): void;
	setPenUp(): void;
	setColor(hex: string): void;
	get State(): Canvas2DState;
	get Log(): Command[];
}

// =============================================================================
// Overlay & Editor Types
// =============================================================================

export interface PathOverlay {
	points: Point[];
	color?: string;
	width?: number;
}

export interface TargetPoint extends Point {
	tolerance?: number;
	/** Optional label/icon for the target */
	icon?: 'apple' | 'flag' | 'star' | 'custom';
}

export type DrawMode = 'path' | 'target' | 'wall' | 'obstacle' | null;

export interface CanvasOverlays {
	showGrid?: boolean;
	gridSize?: number;
	pathOverlay?: Point[];
	targets?: TargetPoint[];
	walls?: Point[];
	obstacles?: Obstacle[];
}

export interface Obstacle {
	x: number;
	y: number;
	width: number;
	height: number;
	type?: 'cactus' | 'spike' | 'wall' | 'custom';
}

// =============================================================================
// Grading Types
// =============================================================================

export interface ComparisonResult {
	score: number;
	passed: boolean;
	details: {
		positionMatch: boolean;
		angleMatch: boolean;
		distance: number;
	};
}

export interface GradeResult {
	passed: boolean;
	score: number;
	message?: string;
	details?: Record<string, any>;
}
