<script lang="ts">
	import type { RobotGridConfig } from '$lib/types/exercise';
	import { clamp, clampInteger, parseNumberInput } from './canvas-sync';
	import { i18n } from '$lib/i18n/index.svelte';

	type Props = {
		grid: RobotGridConfig;
	};

	let { grid = $bindable() }: Props = $props();

	function clampStart() {
		grid.start.x = clamp(grid.start.x, 0, grid.width * grid.cellSize);
		grid.start.y = clamp(grid.start.y, 0, grid.height * grid.cellSize);
	}

	function updateDimension(field: 'width' | 'height', event: Event) {
		grid[field] = clampInteger(parseNumberInput(event, grid[field]), 1, 100);
		clampStart();
	}

	function updateCellSize(event: Event) {
		grid.cellSize = clampInteger(parseNumberInput(event, grid.cellSize), 1, 200);
		clampStart();
	}

	function updateStart(field: 'x' | 'y', event: Event) {
		const max = field === 'x' ? grid.width * grid.cellSize : grid.height * grid.cellSize;
		grid.start[field] = clamp(parseNumberInput(event, grid.start[field]), 0, max);
	}

	function updateDirection(event: Event) {
		grid.direction = (event.currentTarget as HTMLSelectElement)
			.value as RobotGridConfig['direction'];
	}
</script>

<section class="mb-4 rounded-xl border border-base-300 bg-base-100 p-4">
	<h3 class="font-semibold">{i18n.cms_robot_grid_settings}</h3>
	<div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
		<label class="form-control">
			<span class="label-text">{i18n.cms_robot_grid_width}</span>
			<input
				type="number"
				class="input-bordered input input-sm"
				min="1"
				value={grid.width}
				oninput={(e) => updateDimension('width', e)}
			/>
		</label>
		<label class="form-control">
			<span class="label-text">{i18n.cms_robot_grid_height}</span>
			<input
				type="number"
				class="input-bordered input input-sm"
				min="1"
				value={grid.height}
				oninput={(e) => updateDimension('height', e)}
			/>
		</label>
		<label class="form-control">
			<span class="label-text">{i18n.cms_robot_grid_cell_size}</span>
			<input
				type="number"
				class="input-bordered input input-sm"
				min="1"
				value={grid.cellSize}
				oninput={updateCellSize}
			/>
		</label>
		<label class="form-control">
			<span class="label-text">{i18n.cms_robot_grid_start_x}</span>
			<input
				type="number"
				class="input-bordered input input-sm"
				min="0"
				value={grid.start.x}
				oninput={(e) => updateStart('x', e)}
			/>
		</label>
		<label class="form-control">
			<span class="label-text">{i18n.cms_robot_grid_start_y}</span>
			<input
				type="number"
				class="input-bordered input input-sm"
				min="0"
				value={grid.start.y}
				oninput={(e) => updateStart('y', e)}
			/>
		</label>
		<label class="form-control">
			<span class="label-text">{i18n.cms_robot_grid_direction}</span>
			<select
				class="select-bordered select select-sm"
				value={grid.direction}
				onchange={updateDirection}
			>
				<option value="north">{i18n.cms_robot_direction_north}</option>
				<option value="east">{i18n.cms_robot_direction_east}</option>
				<option value="south">{i18n.cms_robot_direction_south}</option>
				<option value="west">{i18n.cms_robot_direction_west}</option>
			</select>
		</label>
	</div>
</section>
