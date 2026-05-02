import { Canvas2D } from './Canvas2D.svelte';
import type { BlockDef } from '$lib/blockly/types';
import type { PathSegment } from '$lib/canvas/types';
import { initBlocks } from '$lib/blockly/BlocklyFactory';

export class Turtle extends Canvas2D {
	override readonly engineId = 'turtle';

	pen = false;
	color = '#000000';
	_path: PathSegment[] = [];

	override get path(): PathSegment[] {
		return this._path;
	}

	// Turtle-specific blocks that extend the shared Canvas2D blocks.
	static readonly TURTLE_BLOCKS: BlockDef[] = [
		{
			id: 'pen',
			// More kid-friendly label; dropdown text is "draw" / "don't draw"
			message: 'pen is %1',
			args: [
				{
					type: 'dropdown',
					name: 'STATE',
					options: [
						['draw', 'down'],
						["don't draw", 'up']
					]
				}
			],
			color: 160,
			method: 'setPen'
		},
		{
			id: 'color',
			// Kid-friendly label for line color
			message: 'line color %1',
			args: [{ type: 'color', name: 'COLOR', default: '#ff0000' }],
			color: 160,
			// Method name must match what the Blockly generator calls: api.color(...)
			method: 'color'
		}
	];

	// Merge shared Canvas2D blocks with Turtle-specific ones.
	override get blockDefs(): BlockDef[] {
		return [...super.blockDefs, ...Turtle.TURTLE_BLOCKS];
	}

	constructor(width: number, height: number) {
		super(width, height);
		// Register all blocks for this engine once.
		initBlocks(this.blockDefs, 'turtle');
	}

	override move(distance: number): void {
		const from = { x: this.state.x, y: this.state.y };
		super.move(distance);
		if (this.pen) {
			// Add path segment
			this._path = [
				...this._path,
				{
					from,
					to: { x: this.state.x, y: this.state.y },
					color: this.color,
					width: 2
				}
			];
		}
	}

	// Add pen methods
	penUp(): void {
		this.pen = false;
		this.log('penUp');
	}

	penDown(): void {
		this.pen = true;
		this.log('penDown');
	}

	// Used by the 'pen' dropdown block: setPen('down' | 'up')
	setPen(state: string): void {
		if (state === 'down') {
			this.penDown();
		} else if (state === 'up') {
			this.penUp();
		}
	}

	setColor(hex: string): void {
		this.color = hex;
		this.log('color', hex);
	}

	override reset(): void {
		super.reset();
		this._path = [];
		this.pen = false;
		this.color = '#000000';
	}

	override get api(): Record<string, (...args: any[]) => void> {
		return {
			...super.api,
			penUp: () => this.penUp(),
			penDown: () => this.penDown(),
			color: (c: string) => this.setColor(c),
			setPen: (state: string) => this.setPen(state)
		};
	}
}
