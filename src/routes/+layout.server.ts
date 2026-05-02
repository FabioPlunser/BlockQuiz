import type { LayoutServerLoad } from './$types';
import { getRequestLocale } from '$lib/server/locale';

export const load: LayoutServerLoad = (event) => {
	return {
		locale: getRequestLocale(event)
	};
};
