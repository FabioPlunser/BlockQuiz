import toast from '$lib/toaster';

/**
 * Standardized server result type for all mutation operations.
 */
export type ServerResult<T = unknown> =
	| { success: true; data?: T; id?: string }
	| { success: false; error: string };

/**
 * Re-export toast for direct usage
 */
export { toast };

/**
 * Debug mode configuration
 * When enabled:
 * - Toasts stay indefinitely (won't auto-dismiss)
 * - Each toast is logged to console with timestamp and type
 */
let debugMode = false;

export function setToastDebug(enabled: boolean): void {
	debugMode = enabled;
	if (enabled) {
		console.log('[Toast Debug] Debug mode ENABLED - toasts will stay indefinitely');
	} else {
		console.log('[Toast Debug] Debug mode DISABLED');
	}
}

export function isToastDebugEnabled(): boolean {
	return debugMode;
}

function logToast(type: 'success' | 'error' | 'info' | 'loading', message: string): void {
	if (debugMode) {
		const timestamp = new Date().toISOString();
		console.log(`[Toast ${timestamp}] [${type.toUpperCase()}] ${message}`);
	}
}

function getDuration(defaultDuration: number): number {
	return debugMode ? Infinity : defaultDuration;
}

/**
 * Handle server action result and show appropriate toast.
 * Use this after calling .updates() on a command or after a form submission.
 *
 * @param result - The result from the server action
 * @param successMessage - Message to show on success
 * @param errorMessage - Optional custom error message (uses result.error if not provided)
 * @returns The original result for chaining
 */
export function handleServerResult<T>(
	result: ServerResult<T>,
	successMessage: string,
	errorMessage?: string
): ServerResult<T> {
	// Dismiss any existing toasts first to prevent overlap (skip in debug mode)
	if (!debugMode) {
		toast.dismiss();
	}

	if (result.success) {
		logToast('success', successMessage);
		toast.success(successMessage, {
			duration: getDuration(3000),
			position: 'top-right'
		});
	} else {
		const msg = errorMessage ?? result.error ?? 'An error occurred';
		logToast('error', msg);
		toast.error(msg, {
			duration: getDuration(4000),
			position: 'top-right'
		});
	}
	return result;
}

/**
 * Show a success toast
 */
export function showSuccess(message: string): void {
	if (!debugMode) {
		toast.dismiss();
	}
	logToast('success', message);
	toast.success(message, {
		duration: getDuration(3000),
		position: 'top-right'
	});
}

/**
 * Show an error toast
 */
export function showError(message: string): void {
	if (!debugMode) {
		toast.dismiss();
	}
	logToast('error', message);
	toast.error(message, {
		duration: getDuration(4000),
		position: 'top-right'
	});
}

/**
 * Show an info toast (uses default style)
 */
export function showInfo(message: string): void {
	logToast('info', message);
	toast(message, {
		duration: getDuration(3000),
		position: 'top-right'
	});
}

/**
 * Show a loading toast that can be updated later
 * @returns toast id for updating
 */
export function showLoading(message: string): string {
	logToast('loading', message);
	return toast.loading(message, {
		position: 'top-right'
	});
}

/**
 * Dismiss a specific toast or all toasts
 */
export function dismissToast(toastId?: string): void {
	if (toastId) {
		toast.dismiss(toastId);
	} else {
		toast.dismiss();
	}
}

/**
 * Promise-based toast for async operations
 * Shows loading, then success or error based on promise resolution
 */
export async function toastPromise<T>(
	promise: Promise<T>,
	messages: {
		loading: string;
		success: string;
		error: string | ((err: unknown) => string);
	}
): Promise<T> {
	logToast('loading', messages.loading);
	return toast.promise(promise, messages);
}
