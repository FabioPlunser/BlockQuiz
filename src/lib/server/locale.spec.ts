import { describe, expect, it } from 'vitest';
import { getLocaleFromAcceptLanguage, isSupportedLocale } from './locale';

describe('server locale helpers', () => {
	it('recognizes supported locales', () => {
		expect.assertions(3);

		expect(isSupportedLocale('de')).toBe(true);
		expect(isSupportedLocale('en')).toBe(true);
		expect(isSupportedLocale('fr')).toBe(false);
	});

	it('derives locale from Accept-Language with English fallback', () => {
		expect.assertions(3);

		expect(getLocaleFromAcceptLanguage('de-AT,de;q=0.9,en;q=0.8')).toBe('de');
		expect(getLocaleFromAcceptLanguage('fr-FR, en;q=0.8')).toBe('en');
		expect(getLocaleFromAcceptLanguage(null)).toBe('en');
	});
});
