import { Canvas2D } from './Canvas2D.svelte';
import type { BlockDef } from '$lib/blockly/types';
import type { Point, PositionState } from '$lib/canvas/types';
import { initBlocks } from '$lib/blockly/BlocklyFactory';

type RobotDirection = 'north' | 'east' | 'south' | 'west';

type RobotOptions = {
	start?: Point;
	direction?: RobotDirection;
};

function directionToAngle(direction: RobotDirection = 'north'): number {
	if (direction === 'east') return 90;
	if (direction === 'south') return 180;
	if (direction === 'west') return 270;
	return 0;
}

// Simple Grid Robot engine that reuses the shared Canvas2D movement blocks.
export class Robot extends Canvas2D {
	override readonly engineId = 'robot';
	private readonly initialState: PositionState;

	static readonly ROBOT_BLOCKS: BlockDef[] = [
		{
			id: 'collect',
			message: 'collect item',
			color: 210,
			tooltip: 'Collect an item on the current grid cell.',
			method: 'collect'
		}
	];

	override get blockDefs(): BlockDef[] {
		// For now just reuse the shared Canvas2D blocks.
		// When you add ROBOT_BLOCKS, spread them in as well.
		return [...super.blockDefs, ...Robot.ROBOT_BLOCKS];
	}

	constructor(width: number, height: number, options: RobotOptions = {}) {
		super(width, height);
		this.initialState = {
			x: options.start?.x ?? width / 2,
			y: options.start?.y ?? height / 2,
			angle: directionToAngle(options.direction)
		};
		this.state = { ...this.initialState };
		initBlocks(this.blockDefs, 'robot');
	}

	override reset() {
		this.state = { ...this.initialState };
		this.commands = [];
	}

	collect() {
		this.log('collect');
	}

	override get api(): Record<string, (...args: any[]) => void> {
		return {
			...super.api,
			collect: () => this.collect()
		};
	}
}
