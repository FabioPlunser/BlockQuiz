import { pushState } from '$app/navigation';

export function usePageParams<const K extends readonly string[]>(
	page: any,
	keys: K
) {
	return new Proxy({}, {
		get(target: any, prop: string | symbol) {
			if (typeof prop === 'string' && keys.includes(prop)) {
				return page.url.searchParams.get(prop);
			}
		},
	set(target: any, prop: string | symbol, value: any) {
			if (typeof prop === 'string' && keys.includes(prop)) {
				const params = new URLSearchParams(page.url.searchParams);
				if (value === undefined || value === null) {
					params.delete(prop);
				} else {
					params.set(prop, String(value));
				}
				const state: App.PageState = {
					courseId: page.state?.courseId ?? null,
					exerciseId: page.state?.exerciseId ?? null
				};
				pushState(`?${params.toString()}`, state);
			}
			return true;
		}
	}) as Record<K[number], string | null>;
}
