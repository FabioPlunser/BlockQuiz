<script lang="ts">
	import type { RemoteForm } from '@sveltejs/kit';
	import type { Snippet } from 'svelte';
	import { i18n } from '$lib/i18n/index.svelte';
	import { showSuccess, showError } from '$lib/utils/toast';

	let {
		open = $bindable(),
		remoteFunction,
		onClose = () => {},
		title = '',
		successMessage = '',
		children,
		controls
	}: {
		open?: boolean;
		remoteFunction: RemoteForm<any, any>;
		onClose?: () => void;
		title?: string;
		successMessage?: string;
		children?: Snippet;
		controls?: Snippet;
	} = $props();

	let effectiveSuccessMessage = $derived(successMessage || i18n.modal_generic_success);

	let dialogRef: HTMLDialogElement;
	$effect(() => {
		if (dialogRef && open) {
			dialogRef.showModal();
		} else if (dialogRef && !open) {
			dialogRef.close();
		}
	});
	function handleBackdropClick(e: Event) {
		if (e.target === dialogRef) {
			open = false;
		}
	}
	function handleClose() {
		open = false;
		onClose();
	}
</script>

<dialog bind:this={dialogRef} class="modal" onclick={handleBackdropClick} onclose={handleClose}>
	<form
		{...remoteFunction.enhance(async ({ submit }) => {
			try {
				await submit();
				const issues = remoteFunction.fields.allIssues();
				if (!issues || issues.length === 0) {
					showSuccess(effectiveSuccessMessage);
					handleClose();
				} else {
					showError(issues[0].message);
				}
			} catch (error) {
				console.error(error);
				showError(i18n.toast_generic_error);
			}
		})}
	>
		<div class="modal-box">
			{#if title}
				<h3 class="text-lg font-bold">{title}</h3>
			{/if}
			{@render children?.()}
			<div class="modal-action">
				<div class="flex gap-4">
					{@render controls?.()}
					<button type="button" class="btn" onclick={handleClose}>
						{i18n.modal_close}
					</button>
				</div>
			</div>
		</div>
	</form>
</dialog>
