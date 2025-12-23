import type { Command, Canvas2DState, ICanvas2D } from '$lib/canvas/types';
import type { BlockDef } from '$lib/blockly/types';

export class Canvas2D implements ICanvas2D {
	state = $state<Canvas2DState>({ x: 0, y: 0, angle: 0 });
	commands = $state<Command[]>([]);

	readonly width: number = $state(400);
	readonly height: number = $state(400);
	gridSize = 50;

	// Core Canvas2D blocks that are shared across all engines (Turtle, Robot, ...)
	protected _blockDefs: BlockDef[] = [
		{
			id: 'move',
			message: 'move %1 steps',
			args: [{ type: 'number', name: 'DISTANCE', default: 10 }],
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

	// Public view used by the interface; subclasses can override to extend.
	get blockDefs(): BlockDef[] {
		return this._blockDefs;
	}
	constructor(width: number, height: number) {
		this.width = width;
		this.height = height;
		this.state.y = height / 2;
		this.state.x = width / 2;
	}

	protected moveBy(distance: number) {
		const rad = (this.state.angle * Math.PI) / 180;
		this.state.x += distance * Math.sin(rad);
		this.state.y -= distance * Math.cos(rad);
	}

	protected turnBy(degrees: number) {
		this.state.angle = (this.state.angle + degrees) % 360;
		if (this.state.angle < 0) this.state.angle += 360;
	}

	protected log(type: string, ...args: (string | number)[]) {
		// Store args as string[] to satisfy the Command type while keeping numbers readable.
		this.commands.push({ type, args: args.map((a) => String(a)), timestamp: Date.now() });
	}

	get State() {
		return this.state;
	}

	get Log() {
		return this.commands;
	}

	reset() {
		this.state.x = this.width / 2;
		this.state.y = this.height / 2;
		this.state.angle = 0;
		this.commands = [];
	}

	move(cells: number) {
		// Treat "distance" argument as number of grid cells, not raw pixels.
		const distancePx = cells * this.gridSize;
		this.moveBy(distancePx);
		this.log('move', cells);
	}

	turn(degrees: number) {
		this.turnBy(degrees);
		this.log('turn', degrees);
	}

	setPenDown() {
		this.log('pen', 'down');
	}

	setPenUp() {
		this.log('pen', 'up');
	}

	setColor(hex: string) {
		this.log('color', hex);
	}

	get api() {
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
