import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';
import { i18n } from '$lib/i18n/index.svelte';
import type { LocalizedString } from '$lib/types/exercise';

/**
 * Extracts searchable text from a LocalizedString based on current locale
 */
export function getSearchableText(localized: LocalizedString): string {
	const locale = i18n.locale === 'de' || i18n.locale === 'en' ? i18n.locale : 'en';
	return (localized[locale] || localized.en || localized.de || '').toLowerCase();
}

/**
 * Recursively extracts all searchable text from an object
 * Handles LocalizedString objects and regular strings
 */
export function extractSearchableText(obj: any, locale: 'de' | 'en' = 'en'): string {
	const texts: string[] = [];

	function traverse(value: any, depth = 0) {
		// Prevent infinite recursion
		if (depth > 10) return;

		if (value === null || value === undefined) return;

		// Handle LocalizedString objects
		if (value && typeof value === 'object' && 'de' in value && 'en' in value) {
			const localized = value as LocalizedString;
			const text = localized[locale] || localized.en || localized.de || '';
			if (text) texts.push(text.toLowerCase());
			return;
		}

		// Handle strings
		if (typeof value === 'string' && value.trim()) {
			texts.push(value.toLowerCase());
			return;
		}

		// Handle arrays
		if (Array.isArray(value)) {
			value.forEach((item) => traverse(item, depth + 1));
			return;
		}

		// Handle objects
		if (typeof value === 'object') {
			Object.values(value).forEach((val) => traverse(val, depth + 1));
		}
	}

	traverse(obj);
	return texts.join(' ');
}

/**
 * Generic fuzzy search function that works with any array of objects
 * @param items - Array of items to search
 * @param searchQuery - Search query string
 * @param options - Optional Fuse.js options or a function to extract searchable text
 */
export function fuzzySearch<T>(
	items: T[],
	searchQuery: string,
	options?: IFuseOptions<T> | ((item: T) => string)
): T[] {
	if (!searchQuery?.trim()) {
		return items;
	}

	const trimmedQuery = searchQuery.trim();

	// If options is a function, use it to create searchable text
	if (typeof options === 'function') {
		const searchableItems = items.map((item) => ({
			item,
			searchText: options(item)
		}));

		const fuse = new Fuse(searchableItems, {
			keys: ['searchText'],
			threshold: 0.4,
			ignoreLocation: true,
			includeScore: false
		});

		return fuse.search(trimmedQuery).map((result) => result.item.item);
	}

	// Otherwise use Fuse.js with provided options
	const fuseOptions: IFuseOptions<T> = {
		threshold: 0.4,
		ignoreLocation: true,
		...options
	};

	const fuse = new Fuse(items, fuseOptions);
	return fuse.search(trimmedQuery).map((result) => result.item);
}

/**
 * Creates a fuzzy search function for localized objects
 * Automatically extracts searchable text from LocalizedString fields
 */
export function createLocalizedFuzzySearch<T>(
	items: T[],
	searchQuery: string,
	locale?: 'de' | 'en'
): T[] {
	const currentLocale =
		locale || (i18n.locale === 'de' || i18n.locale === 'en' ? i18n.locale : 'en');

	return fuzzySearch(items, searchQuery, (item) => {
		return extractSearchableText(item, currentLocale);
	});
}
