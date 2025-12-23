import { Canvas2D } from './Canvas2D.svelte';
import type { BlockDef } from '$lib/blockly/types';
import { initBlocks } from '$lib/blockly/BlocklyFactory';

// Simple Grid Robot engine that reuses the shared Canvas2D blocks.
// You can extend this later with grid-aware movement and sensor blocks.
export class Robot extends Canvas2D {
  // Robot-specific blocks (placeholder for now).
  // Example: you might later add "collect", "eat", or sensor blocks here.
  static readonly ROBOT_BLOCKS: BlockDef[] = [];

  override get blockDefs(): BlockDef[] {
    // For now just reuse the shared Canvas2D blocks.
    // When you add ROBOT_BLOCKS, spread them in as well.
    return [...super.blockDefs, ...Robot.ROBOT_BLOCKS];
  }

  constructor(width: number, height: number) {
    super(width, height);
    initBlocks(this.blockDefs, 'robot');
  }
}


