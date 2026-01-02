<script lang="ts">
	import type { ExerciseType, ExerciseMode } from '$lib/types/exercise';

	let {
		type = $bindable('turtle'),
		mode = $bindable('default')
	}: {
		type: ExerciseType;
		mode: ExerciseMode;
	} = $props();

	interface TypeOption {
		value: ExerciseType;
		label: string;
		description: string;
		icon: string;
	}

	interface ModeOption {
		value: ExerciseMode;
		label: string;
		description: string;
		availableFor: ExerciseType[];
	}

	const typeOptions: TypeOption[] = [
		{
			value: 'io',
			label: 'Input/Output',
			description: 'Text-based input and output exercises',
			icon: '⌨️'
		},
		{
			value: 'turtle',
			label: 'Turtle Graphics',
			description: 'Draw shapes using turtle movement',
			icon: '🐢'
		},
		{
			value: 'robot',
			label: 'Robot',
			description: 'Navigate a robot through a grid',
			icon: '🤖'
		}
	];

	const modeOptions: ModeOption[] = [
		{
			value: 'default',
			label: 'Default',
			description: 'Standard exercise mode',
			availableFor: ['io', 'turtle', 'robot']
		},
		{
			value: 'path',
			label: 'Follow Path',
			description: 'Follow a predefined path exactly',
			availableFor: ['turtle', 'robot']
		},
		{
			value: 'apple',
			label: 'Reach Target',
			description: 'Navigate to reach the target (apple) while avoiding walls',
			availableFor: ['turtle', 'robot']
		}
	];

	// Filter modes based on selected type
	let availableModes = $derived(modeOptions.filter((m) => m.availableFor.includes(type)));

	// Reset mode if not available for new type
	$effect(() => {
		if (!availableModes.some((m) => m.value === mode)) {
			mode = 'default';
		}
	});
</script>

<div class="type-mode-selector space-y-4">
	<!-- Exercise Type Selection -->
	<div class="form-control">
		<label class="label">
			<span class="label-text font-medium">Exercise Type</span>
		</label>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			{#each typeOptions as option (option.value)}
				<label
					class="card cursor-pointer border-2 transition-all hover:border-primary/50"
					class:border-primary={type === option.value}
					class:border-base-300={type !== option.value}
					style:background={type === option.value ? 'oklch(var(--p) / 0.05)' : undefined}
				>
					<input
						type="radio"
						name="exercise-type"
						value={option.value}
						class="hidden"
						bind:group={type}
					/>
					<div class="card-body p-3">
						<div class="flex items-center gap-2">
							<span class="text-2xl">{option.icon}</span>
							<div>
								<div class="font-medium">{option.label}</div>
								<div class="text-xs text-base-content/60">{option.description}</div>
							</div>
						</div>
					</div>
				</label>
			{/each}
		</div>
	</div>

	<!-- Exercise Mode Selection (conditional on type) -->
	{#if availableModes.length > 1}
		<div class="form-control">
			<label class="label">
				<span class="label-text font-medium">Exercise Mode</span>
			</label>
			<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
				{#each availableModes as option (option.value)}
					<label
						class="card cursor-pointer border-2 transition-all hover:border-secondary/50"
						class:border-secondary={mode === option.value}
						class:border-base-300={mode !== option.value}
						style:background={mode === option.value ? 'oklch(var(--s) / 0.05)' : undefined}
					>
						<input
							type="radio"
							name="exercise-mode"
							value={option.value}
							class="hidden"
							bind:group={mode}
						/>
						<div class="card-body p-3">
							<div class="font-medium">{option.label}</div>
							<div class="text-xs text-base-content/60">{option.description}</div>
						</div>
					</label>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Summary -->
	<div class="rounded-lg bg-base-200 p-3">
		<div class="text-sm">
			<span class="font-medium">Selected:</span>
			<span class="ml-2">
				{typeOptions.find((t) => t.value === type)?.icon}
				{typeOptions.find((t) => t.value === type)?.label}
				{#if mode !== 'default'}
					<span class="text-base-content/60">
						→ {modeOptions.find((m) => m.value === mode)?.label}
					</span>
				{/if}
			</span>
		</div>
	</div>
</div>

