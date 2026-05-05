import { describe, it, expect } from 'vitest';
import en from './en.json';
import de from './de.json';

describe('i18n locale parity', () => {
	const enKeys = Object.keys(en);
	const deKeys = Object.keys(de);

	it('has the same key set in EN and DE', () => {
		const missingInDe = enKeys.filter((k) => !(k in de));
		const missingInEn = deKeys.filter((k) => !(k in en));
		expect(missingInDe).toEqual([]);
		expect(missingInEn).toEqual([]);
	});

	it('has no empty EN values', () => {
		const empty = Object.entries(en).filter(([, v]) => !v || (typeof v === 'string' && !v.trim()));
		expect(empty.map(([k]) => k)).toEqual([]);
	});

	it('has no empty DE values', () => {
		const empty = Object.entries(de).filter(([, v]) => !v || (typeof v === 'string' && !v.trim()));
		expect(empty.map(([k]) => k)).toEqual([]);
	});
});
