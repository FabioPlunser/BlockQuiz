import { Canvas2D } from './Canvas2D.svelte';
import type { BlockDef } from '$lib/blockly/types';
import type { PathSegment, Point, TargetPoint } from '$lib/canvas/types';
import { initBlocks } from '$lib/blockly/BlocklyFactory';
import { localized } from '$lib/blockly/i18n';
import { traceCollision } from '$lib/canvas/collision';

export class Turtle extends Canvas2D {
	override readonly engineId = 'turtle';

	static readonly APPLE_PALETTE = [
		'#ef4444',
		'#f97316',
		'#eab308',
		'#22c55e',
		'#3b82f6',
		'#a855f7'
	] as const;

	pen = $state(false);
	color = $state('#000000');
	_path = $state<PathSegment[]>([]);
	walls = $state<Point[]>([]);
	targets = $state<TargetPoint[]>([]);
	collectedTargets = $state<number[]>([]);
	appleTolerance = 0.5;
	collision = $state<{ x: number; y: number } | null>(null);
	private paletteIndex = 0;

	override get path(): PathSegment[] {
		return this._path;
	}

	// Turtle-specific blocks that extend the shared Canvas2D blocks.
	// `message` is an i18n key resolved by `BlocklyFactory.initBlocks`. Dropdown
	// option labels are resolved here at access time so they pick up the current
	// locale every time `blockDefs` is read.
	static turtleBlocks(): BlockDef[] {
		return [
			{
				id: 'pen',
				message: 'block_turtle_pen',
				args: [
					{
						type: 'dropdown',
						name: 'STATE',
						options: [
							[localized('block_turtle_pen_down'), 'down'],
							[localized('block_turtle_pen_up'), 'up']
						]
					}
				],
				color: 160,
				method: 'setPen'
			},
			{
				id: 'color',
				message: 'block_turtle_color',
				args: [{ type: 'color', name: 'COLOR', default: '#ff0000' }],
				color: 160,
				// Method name must match what the Blockly generator calls: api.color(...)
				method: 'color'
			}
		];
	}

	// Merge shared Canvas2D blocks with Turtle-specific ones.
	override get blockDefs(): BlockDef[] {
		return [...super.blockDefs, ...Turtle.turtleBlocks()];
	}

	constructor(width: number, height: number) {
		super(width, height);
		// Register all blocks for this engine once.
		initBlocks(this.blockDefs, 'turtle');
	}

	override move(distance: number): void {
		if (this.collision) return;

		const from = { x: this.state.x, y: this.state.y };
		super.move(distance);
		const to = { x: this.state.x, y: this.state.y };

		const result = traceCollision({ from, to, walls: this.walls, gridSize: this.gridSize });
		if (result.hit) {
			this.state = { ...this.state, x: result.stop.x, y: result.stop.y };
			this.collision = { x: result.stop.x, y: result.stop.y };
			this.log('collision', Math.round(result.stop.x), Math.round(result.stop.y));
		}

		if (this.pen) {
			this._path = [
				...this._path,
				{ from, to: { x: this.state.x, y: this.state.y }, color: this.color, width: 2 }
			];
		}

		this.checkAppleCollection();
	}

	private checkAppleCollection() {
		if (this.targets.length === 0) return;
		const radius = Math.max(1, this.appleTolerance * this.gridSize);
		const radiusSq = radius * radius;
		const collected = new Set(this.collectedTargets);
		for (let i = 0; i < this.targets.length; i++) {
			if (collected.has(i)) continue;
			const target = this.targets[i];
			const dx = target.x - this.state.x;
			const dy = target.y - this.state.y;
			if (dx * dx + dy * dy <= radiusSq) {
				this.collectedTargets = [...this.collectedTargets, i];
				this.paletteIndex = (this.paletteIndex + 1) % Turtle.APPLE_PALETTE.length;
				this.color = Turtle.APPLE_PALETTE[this.paletteIndex];
				this.log('collect', i);
			}
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
		this.collision = null;
		this.collectedTargets = [];
		this.paletteIndex = 0;
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
