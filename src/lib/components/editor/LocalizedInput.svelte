<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';
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

	const uid = $props.id();

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
		<div class="label">
			<span class="label-text font-medium">{label}</span>
			{#if required}
				<span class="label-text-alt text-error">*</span>
			{/if}
		</div>
	{/if}

	<!-- Language Tabs -->
	<div class="tabs-box mb-2 tabs">
		<button
			type="button"
			class="tab"
			class:tab-active={activeTab === 'de'}
			onclick={() => (activeTab = 'de')}
		>
			{i18n.language_german}
		</button>
		<button
			type="button"
			class="tab"
			class:tab-active={activeTab === 'en'}
			onclick={() => (activeTab = 'en')}
		>
			{i18n.language_english}
		</button>
	</div>

	<!-- Input Fields -->
	<div class="relative">
		{#if type === 'textarea'}
			<textarea
				id={`${uid}-de`}
				name={`${uid}-de`}
				class="textarea-bordered textarea w-full"
				class:hidden={activeTab !== 'de'}
				bind:value={value.de}
				placeholder={placeholder || `${i18n.language_german}...`}
				{required}
				rows="3"
			></textarea>
			<textarea
				id={`${uid}-en`}
				name={`${uid}-en`}
				class="textarea-bordered textarea w-full"
				class:hidden={activeTab !== 'en'}
				bind:value={value.en}
				placeholder={placeholder || `${i18n.language_english}...`}
				{required}
				rows="3"
			></textarea>
		{:else}
			<input
				id={`${uid}-de`}
				name={`${uid}-de`}
				type="text"
				class="input-bordered input w-full"
				class:hidden={activeTab !== 'de'}
				bind:value={value.de}
				placeholder={placeholder || `${i18n.language_german}...`}
				{required}
			/>
			<input
				id={`${uid}-en`}
				name={`${uid}-en`}
				type="text"
				class="input-bordered input w-full"
				class:hidden={activeTab !== 'en'}
				bind:value={value.en}
				placeholder={placeholder || `${i18n.language_english}...`}
				{required}
			/>
		{/if}
	</div>

	<!-- Character count / status indicators -->
	<div class="mt-1 flex justify-between text-xs text-base-content/60">
		<span>
			{#if value.de && !value.en}
				<span class="text-warning">⚠ {i18n.localized_missing_english}</span>
			{:else if value.en && !value.de}
				<span class="text-warning">⚠ {i18n.localized_missing_german}</span>
			{:else if value.de && value.en}
				<span class="text-success">✓ {i18n.localized_both_languages}</span>
			{/if}
		</span>
		<span>
			{activeTab === 'de' ? value.de.length : value.en.length}
			{i18n.localized_characters}
		</span>
	</div>
</div>
