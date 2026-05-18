import type { Exercise } from '$lib/types/exercise';
import type { BlocklyToolboxConfig, BlocklyCategoryConfig } from '$lib/blockly/types';
import { BlocklyToolboxKind } from '$lib/blockly/types';
import { Turtle } from '$lib/canvas/Turtle.svelte';
import { Robot } from '$lib/canvas/Robot.svelte';
import { getCategoryForBlocks } from '$lib/blockly/BlocklyFactory';
import {
	LOGIC_BLOCKS,
	LOOP_BLOCKS,
	MATH_BLOCKS,
	TEXT_BLOCKS,
	VARIABLE_BLOCKS
} from '$lib/blockly/presets';

export type ToolboxLabels = {
	logic: string;
	loops: string;
	math: string;
	text: string;
	variables: string;
	turtle: string;
	robot: string;
};

// Map each builtin category to a theme-resolved category style key. Blockly
// looks the key up in the active theme's `categoryStyles`. Classic supplies
// sensible defaults; the warm theme overrides them with cohesive warm tones.
const BUILTIN_GROUPS: ReadonlyArray<
	[keyof Omit<ToolboxLabels, 'turtle' | 'robot'>, string, readonly string[]]
> = [
	['logic', 'logic_category', LOGIC_BLOCKS],
	['loops', 'loop_category', LOOP_BLOCKS],
	['math', 'math_category', MATH_BLOCKS],
	['text', 'text_category', TEXT_BLOCKS],
	['variables', 'variable_category', VARIABLE_BLOCKS]
];

function buildBuiltinCategories(exercise: Exercise, labels: ToolboxLabels): BlocklyCategoryConfig[] {
	const categories: BlocklyCategoryConfig[] = [];
	for (const [key, categorystyle, ids] of BUILTIN_GROUPS) {
		const contents = ids
			.filter((id) => exercise.config.toolbox.includes(id))
			.map((id) => ({ kind: 'block' as const, type: id }));
		if (contents.length === 0) continue;
		categories.push({ kind: 'category', name: labels[key], categorystyle, contents });
	}
	return categories;
}

export function getEngine(exercise: Exercise) {
	if (exercise.type === 'io') return null;
	if (exercise.type === 'turtle') {
		const { width, height } = exercise.config.canvas;
		const engine = new Turtle(width, height);
		engine.gridSize = exercise.canvas.gridSize;
		engine.walls = exercise.canvas.walls ?? [];
		return engine;
	}
	const width = exercise.grid.width * exercise.grid.cellSize;
	const height = exercise.grid.height * exercise.grid.cellSize;
	const engine = new Robot(width, height, {
		start: exercise.grid.start,
		direction: exercise.grid.direction
	});
	engine.gridSize = exercise.grid.cellSize;
	return engine;
}

export function getToolbox(exercise: Exercise, labels: ToolboxLabels): BlocklyToolboxConfig {
	const builtinCategories = buildBuiltinCategories(exercise, labels);

	if (exercise.type === 'io') {
		return { kind: BlocklyToolboxKind.CATEGORY, contents: builtinCategories };
	}

	const engine = getEngine(exercise);
	const actorLabel = exercise.type === 'turtle' ? labels.turtle : labels.robot;
	const engineBlocks =
		engine?.blockDefs.filter((block) => exercise.config.toolbox.includes(block.id)) ?? [];
	const engineCategory = getCategoryForBlocks(
		engineBlocks,
		exercise.type,
		actorLabel,
		'engine_category'
	);

	return {
		kind: BlocklyToolboxKind.CATEGORY,
		contents: [engineCategory, ...builtinCategories].filter(Boolean)
	};
}
