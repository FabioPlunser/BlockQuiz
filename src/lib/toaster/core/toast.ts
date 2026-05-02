import { dismiss, remove, upsert } from './store';
import {
	resolveValue,
	type Renderable,
	type Toast,
	type ToastOptions,
	type ToastType,
	type ValueOrFunction
} from './types';
import { genId } from './utils';

type ToastHandler = (message: Renderable, options?: ToastOptions) => string;

const createToast = (
	message: Renderable,
	type: ToastType = 'blank',
	opts?: ToastOptions
): Toast => ({
	createdAt: Date.now(),
	visible: true,
	type,
	ariaProps: {
		role: 'status',
		'aria-live': 'polite'
	},
	message,
	pauseDuration: 0,
	...opts,
	id: opts?.id || genId()
});

const createHandler =
	(type: ToastType): ToastHandler =>
	(message, options) => {
		const toast = createToast(message, type, options);
		upsert(toast);
		return toast.id;
	};

const toast = (message: Renderable, opts?: ToastOptions) => createHandler('blank')(message, opts);

toast.error = createHandler('error');
toast.success = createHandler('success');
toast.loading = createHandler('loading');
toast.custom = createHandler('custom');

toast.dismiss = (toastId?: string) => {
	dismiss(toastId);
};

toast.remove = (toastId?: string) => remove(toastId);

toast.promise = <T>(
	promise: Promise<T>,
	msgs: {
		loading: Renderable;
		success: Renderable | ((value: T) => Renderable);
		error: Renderable | ((error: unknown) => Renderable);
	},
	opts?: ToastOptions & {
		loading?: ToastOptions;
		success?: ToastOptions;
		error?: ToastOptions;
	}
) => {
	const id = toast.loading(msgs.loading, { ...opts, ...opts?.loading });

	promise
		.then((p) => {
			const message = resolveValue(msgs.success as ValueOrFunction<Renderable, T>, p);
			toast.success(message, {
				id,
				...opts,
				...opts?.success
			});
			return p;
		})
		.catch((e) => {
			const message = resolveValue(msgs.error as ValueOrFunction<Renderable, unknown>, e);
			toast.error(message, {
				id,
				...opts,
				...opts?.error
			});
		});

	return promise;
};

export default toast;
