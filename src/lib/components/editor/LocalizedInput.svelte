<script lang="ts">
	import type { LocalizedString } from '$lib/types/exercise';

	let {
		value = $bindable({ de: '', en: '' }),
		label = '',
		placeholder = '',
		required = false,
		type = 'text'
	}: {
		value: LocalizedString;
		label?: string;
		placeholder?: string;
		required?: boolean;
		type?: 'text' | 'textarea';
	} = $props();

	let activeTab: 'de' | 'en' = $state('de');
</script>

<!--
  @component

  Localized Input usage
  ```svelte
  <LocalizedInput
		label="Localized Input"
		placeholder="Localized Input"
		required={true}
		type="text"
	/>
	```
-->

<div class="form-control w-full">
	{#if label}
		<label class="label">
			<span class="label-text font-medium">{label}</span>
			{#if required}
				<span class="label-text-alt text-error">*</span>
			{/if}
		</label>
	{/if}

	<!-- Language Tabs -->
	<div role="tablist" class="tabs-box mb-2 tabs">
		<button
			type="button"
			role="tab"
			class="tab"
			class:tab-active={activeTab === 'de'}
			onclick={() => (activeTab = 'de')}
		>
			Deutsch
		</button>
		<button
			type="button"
			role="tab"
			class="tab"
			class:tab-active={activeTab === 'en'}
			onclick={() => (activeTab = 'en')}
		>
			English
		</button>
	</div>

	<!-- Input Fields -->
	<div class="relative">
		{#if type === 'textarea'}
			<textarea
				class="textarea-bordered textarea w-full"
				class:hidden={activeTab !== 'de'}
				bind:value={value.de}
				placeholder={placeholder || 'Deutsch...'}
				{required}
				rows="3"
			></textarea>
			<textarea
				class="textarea-bordered textarea w-full"
				class:hidden={activeTab !== 'en'}
				bind:value={value.en}
				placeholder={placeholder || 'English...'}
				{required}
				rows="3"
			></textarea>
		{:else}
			<input
				type="text"
				class="input-bordered input w-full"
				class:hidden={activeTab !== 'de'}
				bind:value={value.de}
				placeholder={placeholder || 'Deutsch...'}
				{required}
			/>
			<input
				type="text"
				class="input-bordered input w-full"
				class:hidden={activeTab !== 'en'}
				bind:value={value.en}
				placeholder={placeholder || 'English...'}
				{required}
			/>
		{/if}
	</div>

	<!-- Character count / status indicators -->
	<div class="mt-1 flex justify-between text-xs text-base-content/60">
		<span>
			{#if value.de && !value.en}
				<span class="text-warning">⚠ English translation missing</span>
			{:else if value.en && !value.de}
				<span class="text-warning">⚠ German translation missing</span>
			{:else if value.de && value.en}
				<span class="text-success">✓ Both languages</span>
			{/if}
		</span>
		<span>
			{activeTab === 'de' ? value.de.length : value.en.length} chars
		</span>
	</div>
</div>
