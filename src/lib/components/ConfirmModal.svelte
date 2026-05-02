<script lang="ts">
	import { i18n } from '$lib/i18n/index.svelte';

	let {
		open = $bindable(false),
		message = '',
		confirmLabel = '',
		confirmClass = 'btn-error',
		onConfirm,
		onCancel
	}: {
		open?: boolean;
		message?: string;
		confirmLabel?: string;
		confirmClass?: string;
		onConfirm: () => void;
		onCancel?: () => void;
	} = $props();

	let dialogRef: HTMLDialogElement | undefined = $state(undefined);

	$effect(() => {
		if (!dialogRef) return;
		if (open && !dialogRef.open) {
			dialogRef.showModal();
		} else if (!open && dialogRef.open) {
			dialogRef.close();
		}
	});

	function handleConfirm() {
		onConfirm();
		open = false;
	}

	function handleCancel() {
		open = false;
		onCancel?.();
	}

	function handleBackdropClick(e: Event) {
		if (e.target === dialogRef) {
			handleCancel();
		}
	}
</script>

<dialog
	bind:this={dialogRef}
	class="modal"
	onclick={handleBackdropClick}
	oncancel={(event) => {
		event.preventDefault();
		handleCancel();
	}}
	onclose={() => (open = false)}
>
	<div class="modal-box">
		<p class="py-2 whitespace-pre-line">{message}</p>
		<div class="modal-action">
			<button class="btn btn-ghost" onclick={handleCancel}>{i18n.cancel}</button>
			<button class={['btn', confirmClass]} onclick={handleConfirm}>
				{confirmLabel || i18n.cms_delete}
			</button>
		</div>
	</div>
</dialog>
