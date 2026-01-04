// Core exports
export { default as toast } from './core/toast';
export { default as useToaster } from './core/use-toaster';
export { useToasterStore, toasts, dismiss, remove } from './core/store';
export { genId, prefersReducedMotion } from './core/utils';
export { resolveValue } from './core/types';

// Type exports
export type {
	Toast,
	ToastType,
	ToastPosition,
	ToastOptions,
	DefaultToastOptions,
	ToasterProps,
	DOMToast,
	IconTheme,
	Renderable
} from './core/types';

// Component exports
export { default as Toaster } from './components/Toaster.svelte';
export { default as ToastBar } from './components/ToastBar.svelte';
export { default as ToastIcon } from './components/ToastIcon.svelte';
export { default as ToastMessage } from './components/ToastMessage.svelte';
export { default as ToastWrapper } from './components/ToastWrapper.svelte';
export { default as CheckmarkIcon } from './components/CheckmarkIcon.svelte';
export { default as ErrorIcon } from './components/ErrorIcon.svelte';
export { default as LoaderIcon } from './components/LoaderIcon.svelte';

// Default export
export { default } from './core/toast';

