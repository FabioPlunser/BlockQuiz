import { query } from '$app/server';
import { db } from '$server/db';
import { eq, and } from 'drizzle-orm';
import { translations } from '$server/db/schema';

/**
 * Fetches all translations for a given locale from the database
 * Usage: const dict = await getTranslations('en');
 */
export const getTranslations = query(async () => {
	// Get locale from query params or default to 'en'
	// Note: In actual usage, you'll pass locale as a parameter when calling this
	const allTranslations = await db.query.translations.findMany();

	// Group by locale
	const byLocale: Record<string, Record<string, string>> = {};
	for (const translation of allTranslations) {
		if (!byLocale[translation.locale]) {
			byLocale[translation.locale] = {};
		}
		byLocale[translation.locale][translation.key] = translation.value;
	}

	return byLocale;
});

/**
 * Fetches available locales from the database
 */
export const getAvailableLocales = query(async () => {
	const result = await db.selectDistinct({ locale: translations.locale }).from(translations);

	return result.map((r) => r.locale);
});
