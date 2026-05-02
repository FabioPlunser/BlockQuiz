import { pushState } from '$app/navigation';
import { SvelteURLSearchParams } from 'svelte/reactivity';

export function usePageParams<const K extends readonly string[]>(page: any, keys: K) {
	return new Proxy(
		{},
		{
			get(target: any, prop: string | symbol) {
				if (typeof prop === 'string' && keys.includes(prop)) {
					return page.url.searchParams.get(prop);
				}
			},
			set(target: any, prop: string | symbol, value: any) {
				if (typeof prop === 'string' && keys.includes(prop)) {
					const params = new SvelteURLSearchParams(page.url.searchParams);
					if (value === undefined || value === null) {
						params.delete(prop);
					} else {
						params.set(prop, String(value));
					}
					const state: App.PageState = {
						courseId: page.state?.courseId ?? null,
						exerciseId: page.state?.exerciseId ?? null
					};
					const query = params.toString();
					// The next URL is derived from the current page path and query params.
					// eslint-disable-next-line svelte/no-navigation-without-resolve
					pushState(`${page.url.pathname}${query ? `?${query}` : ''}`, state);
				}
				return true;
			}
		}
	) as Record<K[number], string | null>;
}
