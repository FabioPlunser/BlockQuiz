import type { Command, PositionState, IPositionEngine, PathSegment } from '$lib/canvas/types';
import type { BlockDef } from '$lib/blockly/types';

/**
 * Base class for position-based 2D canvas engines.
 * Provides move/turn mechanics and command logging.
 * Subclasses: Turtle (with pen), Robot (grid-based), etc.
 */
export class Canvas2D implements IPositionEngine {
	state: PositionState = { x: 0, y: 0, angle: 0 };
	commands: Command[] = [];

	readonly width: number;
	readonly height: number;
	gridSize = 50;

	/** Unique identifier for this engine type (used for block prefixing) */
	readonly engineId: string = 'canvas2d';

	// Core Canvas2D blocks shared across position-based engines
	protected _blockDefs: BlockDef[] = [
		{
			id: 'move',
			message: 'move %1 steps',
			args: [{ type: 'number', name: 'DISTANCE', default: 1 }],
			color: 160,
			method: 'move'
		},
		{
			id: 'turn',
			message: 'turn %1 degrees',
			args: [{ type: 'number', name: 'DEGREES', default: 90 }],
			color: 160,
			method: 'turn'
		}
	];

	get blockDefs(): BlockDef[] {
		return this._blockDefs;
	}

	/** Override in subclasses to provide trail/path segments */
	get path(): PathSegment[] {
		return [];
	}

	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.state = {
			x: width / 2,
			y: height / 2,
			angle: 0
		};
	}

	protected moveBy(distance: number) {
		const rad = (this.state.angle * Math.PI) / 180;
		this.state = {
			...this.state,
			x: this.state.x + distance * Math.sin(rad),
			y: this.state.y - distance * Math.cos(rad)
		};
	}

	protected turnBy(degrees: number) {
		let angle = (this.state.angle + degrees) % 360;
		if (angle < 0) angle += 360;
		this.state = {
			...this.state,
			angle
		};
	}

	protected log(type: string, ...args: (string | number)[]) {
		this.commands = [
			...this.commands,
			{ type, args: args.map((a) => String(a)), timestamp: Date.now() }
		];
	}

	// Legacy getters for backward compatibility
	get State() {
		return this.state;
	}

	get Log() {
		return this.commands;
	}

	reset() {
		this.state = {
			x: this.width / 2,
			y: this.height / 2,
			angle: 0
		};
		this.commands = [];
	}

	move(cells: number) {
		const distancePx = cells * this.gridSize;
		this.moveBy(distancePx);
		this.log('move', cells);
	}

	turn(degrees: number) {
		this.turnBy(degrees);
		this.log('turn', degrees);
	}

	// Pen methods (no-op in base class, overridden in Turtle)
	setPenDown() {
		this.log('pen', 'down');
	}

	setPenUp() {
		this.log('pen', 'up');
	}

	setColor(hex: string) {
		this.log('color', hex);
	}

	get api(): Record<string, (...args: any[]) => void> {
		return {
			move: (d: number) => this.move(d),
			turn: (d: number) => this.turn(d),
			penUp: () => this.setPenUp(),
			penDown: () => this.setPenDown(),
			color: (c: string) => this.setColor(c),
			reset: () => this.reset()
		};
	}
}
