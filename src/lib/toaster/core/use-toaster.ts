import toast from './toast';
import { endPause as _endPause, startPause as _startPause, update, useToasterStore } from './store';
import { onDestroy } from 'svelte';
import type { Toast, DefaultToastOptions, DOMToast } from './types';

interface CalculateOffsetOptions {
	reverseOrder?: boolean;
	gutter?: number;
	defaultPosition?: string;
}

function calculateOffset(
	toast: Toast,
	$toasts: Toast[],
	opts?: CalculateOffsetOptions
): number {
	const { reverseOrder, gutter = 8, defaultPosition } = opts || {};
	const relevantToasts = $toasts.filter(
		(t) => (t.position || defaultPosition) === (toast.position || defaultPosition) && t.height
	);
	const toastIndex = relevantToasts.findIndex((t) => t.id === toast.id);
	const toastsBefore = relevantToasts.filter((_, i) => i < toastIndex && relevantToasts[i].visible)
		.length;
	const offset = relevantToasts
		.filter((t) => t.visible)
		.slice(...(reverseOrder ? [toastsBefore + 1] : [0, toastsBefore]))
		.reduce((acc, t) => acc + (t.height || 0) + gutter, 0);
	return offset;
}

const handlers = {
	startPause() {
		_startPause(Date.now());
	},
	endPause() {
		_endPause(Date.now());
	},
	updateHeight: (toastId: string, height: number) => {
		update({ id: toastId, height });
	},
	calculateOffset
};

export default function useToaster(toastOptions?: DefaultToastOptions) {
	const { toasts, pausedAt } = useToasterStore(toastOptions);
	const timeouts = new Map<string, ReturnType<typeof setTimeout>>();
	let _pausedAt: number | null = null;

	const unsubscribes = [
		pausedAt.subscribe(($pausedAt) => {
			if ($pausedAt) {
				for (const [, timeoutId] of timeouts) {
					clearTimeout(timeoutId);
				}
				timeouts.clear();
			}
			_pausedAt = $pausedAt;
		}),
		toasts.subscribe(($toasts) => {
			if (_pausedAt) {
				return;
			}
			const now = Date.now();
			for (const t of $toasts) {
				if (timeouts.has(t.id)) {
					continue;
				}
				if (t.duration === Infinity) {
					continue;
				}
				const durationLeft = (t.duration || 0) + t.pauseDuration - (now - t.createdAt);
				if (durationLeft < 0) {
					if (t.visible) {
						toast.dismiss(t.id);
					}
					continue;
				}
				timeouts.set(t.id, setTimeout(() => toast.dismiss(t.id), durationLeft));
			}
		})
	];

	onDestroy(() => {
		for (const unsubscribe of unsubscribes) {
			unsubscribe();
		}
	});

	return { toasts, handlers };
}

