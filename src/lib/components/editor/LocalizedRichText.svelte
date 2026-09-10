<script lang="ts">
	import { browser } from '$app/environment';
	import { i18n } from '$lib/i18n/index.svelte';
	import { onMount, onDestroy } from 'svelte';
	import type { LocalizedString } from '$lib/types/exercise';

	let {
		value = $bindable({ de: '', en: '' }),
		label = '',
		placeholder = '',
		required = false
	}: {
		value: LocalizedString;
		label?: string;
		placeholder?: string;
		required?: boolean;
	} = $props();

	const uid = $props.id();

	let activeTab: 'de' | 'en' = $state('de');
	let editorDeRef: HTMLDivElement;
	let editorEnRef: HTMLDivElement;
	let quillDe: any = null;
	let quillEn: any = null;
	let isInitialized = $state(false);

	onMount(async () => {
		if (!browser) return;

		try {
			// Dynamically import Quill
			const Quill = (await import('quill')).default;

			// Import Quill styles
			await import('quill/dist/quill.snow.css');

			const toolbarOptions = [
				['bold', 'italic', 'underline', 'strike'],
				['blockquote', 'code-block'],
				[{ header: 1 }, { header: 2 }],
				[{ list: 'ordered' }, { list: 'bullet' }],
				[{ indent: '-1' }, { indent: '+1' }],
				['link'],
				['clean']
			];

			// Initialize German editor
			quillDe = new Quill(editorDeRef, {
				theme: 'snow',
				modules: { toolbar: toolbarOptions },
				placeholder: placeholder || `${i18n.language_german}...`
			});

			// Set initial content
			if (value.de) {
				quillDe.root.innerHTML = value.de;
			}

			// Update value on change
			quillDe.on('text-change', () => {
				value = { ...value, de: quillDe.root.innerHTML };
			});

			// Initialize English editor
			quillEn = new Quill(editorEnRef, {
				theme: 'snow',
				modules: { toolbar: toolbarOptions },
				placeholder: placeholder || `${i18n.language_english}...`
			});

			if (value.en) {
				quillEn.root.innerHTML = value.en;
			}

			quillEn.on('text-change', () => {
				value = { ...value, en: quillEn.root.innerHTML };
			});

			isInitialized = true;
		} catch (e) {
			console.error('Failed to load Quill editor:', e);
		}
	});

	onDestroy(() => {
		// Quill doesn't have a destroy method, but we can clean up references
		quillDe = null;
		quillEn = null;
	});

	// Helper to check if content is empty (ignoring empty HTML tags)
	function isContentEmpty(html: string): boolean {
		const text = html.replace(/<[^>]*>/g, '').trim();
		return text.length === 0;
	}
</script>

<div class="form-control w-full">
	{#if label}
		<div class="label" id={`${uid}-label`}>
			<span class="label-text font-medium">{label}</span>
			{#if required}
				<span class="label-text-alt text-error">*</span>
			{/if}
		</div>
	{/if}

	<!-- Language Tabs -->
	<div role="tablist" class="tabs-box mb-2 tabs">
		<button
			type="button"
			id={`${uid}-de-tab`}
			role="tab"
			aria-selected={activeTab === 'de'}
			aria-controls={`${uid}-de-panel`}
			class="tab"
			class:tab-active={activeTab === 'de'}
			onclick={() => (activeTab = 'de')}
		>
			{i18n.language_german}
		</button>
		<button
			type="button"
			id={`${uid}-en-tab`}
			role="tab"
			aria-selected={activeTab === 'en'}
			aria-controls={`${uid}-en-panel`}
			class="tab"
			class:tab-active={activeTab === 'en'}
			onclick={() => (activeTab = 'en')}
		>
			{i18n.language_english}
		</button>
	</div>

	<!-- Editor Containers -->
	<div class="richtext-editors">
		<div
			id={`${uid}-de-panel`}
			role="tabpanel"
			aria-labelledby={`${uid}-de-tab`}
			class:hidden={activeTab !== 'de'}
		>
			<div bind:this={editorDeRef} class="richtext-editor" aria-labelledby={`${uid}-label`}></div>
		</div>
		<div
			id={`${uid}-en-panel`}
			role="tabpanel"
			aria-labelledby={`${uid}-en-tab`}
			class:hidden={activeTab !== 'en'}
		>
			<div bind:this={editorEnRef} class="richtext-editor" aria-labelledby={`${uid}-label`}></div>
		</div>
	</div>

	{#if !isInitialized}
		<div class="flex items-center justify-center py-8">
			<span class="loading loading-md loading-spinner"></span>
			<span class="ml-2 text-sm text-base-content/60">{i18n.loading}</span>
		</div>
	{/if}

	<!-- Status indicators -->
	<div class="mt-1 flex justify-between text-xs text-base-content/60">
		<span>
			{#if !isContentEmpty(value.de) && isContentEmpty(value.en)}
				<span class="text-warning">⚠ {i18n.localized_missing_english}</span>
			{:else if !isContentEmpty(value.en) && isContentEmpty(value.de)}
				<span class="text-warning">⚠ {i18n.localized_missing_german}</span>
			{:else if !isContentEmpty(value.de) && !isContentEmpty(value.en)}
				<span class="text-success">✓ {i18n.localized_both_languages}</span>
			{/if}
		</span>
	</div>
</div>

<style>
	.richtext-editors :global(.ql-container) {
		min-height: 150px;
		font-size: 1rem;
	}

	.richtext-editors :global(.ql-editor) {
		min-height: 150px;
	}

	.richtext-editors :global(.ql-toolbar) {
		border-top-left-radius: 0.5rem;
		border-top-right-radius: 0.5rem;
		background: oklch(var(--b2));
	}

	.richtext-editors :global(.ql-container) {
		border-bottom-left-radius: 0.5rem;
		border-bottom-right-radius: 0.5rem;
	}
</style>
