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

	// `message` and `tooltip` are i18n keys resolved by `BlocklyFactory.initBlocks`.
	static readonly ROBOT_BLOCKS: BlockDef[] = [
		{
			id: 'step',
			message: 'block_robot_step',
			color: 160,
			tooltip: 'block_robot_step_tooltip',
			method: 'step'
		},
		{
			id: 'turn_left',
			message: 'block_robot_turn_left',
			color: 160,
			tooltip: 'block_robot_turn_left_tooltip',
			method: 'turn_left'
		},
		{
			id: 'turn_right',
			message: 'block_robot_turn_right',
			color: 160,
			tooltip: 'block_robot_turn_right_tooltip',
			method: 'turn_right'
		},
		{
			id: 'collect',
			message: 'block_robot_collect',
			color: 210,
			tooltip: 'block_robot_collect_tooltip',
			method: 'collect'
		}
	];

	override get blockDefs(): BlockDef[] {
		return Robot.ROBOT_BLOCKS;
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

	step() {
		this.move(1);
	}

	turn_left() {
		this.turn(-90);
	}

	turn_right() {
		this.turn(90);
	}

	collect() {
		this.log('collect');
	}

	override get api(): Record<string, (...args: any[]) => void> {
		return {
			...super.api,
			step: () => this.step(),
			turn_left: () => this.turn_left(),
			turn_right: () => this.turn_right(),
			collect: () => this.collect()
		};
	}
}
