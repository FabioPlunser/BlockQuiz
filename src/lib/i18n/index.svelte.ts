import { browser } from '$app/environment';
import type { LocalizedString } from '$types/exercise';
import enMessages from './en.json';
import deMessages from './de.json';

type Dictionary = Record<string, any>;

const FALLBACK_LOCALE = 'en';
const BUILTIN_MESSAGES = {
	en: enMessages,
	de: deMessages
} satisfies Record<string, Dictionary>;

/** Helper to get/set locale from cookies */
const getCookieLocale = (): string => {
	if (!browser) return '';
	const match = document.cookie.match(/(?:^|;\s*)i18n-locale=([^;]*)/);
	return match ? decodeURIComponent(match[1]) : '';
};

const setCookieLocale = (value: string) => {
	if (!browser) return;
	document.cookie = `i18n-locale=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
};

const applyDocumentLocale = (value: string) => {
	if (!browser) return;
	document.documentElement.lang = value;
};

const getInitialLocale = (availableLocales: string[]) => {
	const savedLocale = getCookieLocale();
	if (savedLocale && availableLocales.includes(savedLocale)) {
		return savedLocale;
	}

	if (browser) {
		const navigatorLocale = deriveLocaleFromNavigator(FALLBACK_LOCALE);
		if (availableLocales.includes(navigatorLocale)) {
			return navigatorLocale;
		}
	}

	return availableLocales[0] ?? FALLBACK_LOCALE;
};

function deriveLocaleFromNavigator(deflt: string) {
	if (navigator.language in BUILTIN_MESSAGES) {
		return navigator.language;
	}
	if (navigator.language.includes('-')) {
		const [firstPart] = navigator.language.split('-');
		if (firstPart in BUILTIN_MESSAGES) {
			return firstPart;
		}
	}
	return deflt;
}

const bootstrapLocale = getInitialLocale(
	Object.keys(BUILTIN_MESSAGES)
) as keyof typeof BUILTIN_MESSAGES;

/** The loaded locale dictionary. */
let currentLocaleDict: Dictionary = $state.raw(BUILTIN_MESSAGES[bootstrapLocale] ?? enMessages);
/** The dictionary which keys will be used if they are not present in the currentLocaleDict. */
let fallbackLocaleDict: Dictionary = $state.raw(enMessages);
/** Precalculated, merged dictionary that will be used in your components. */
const mergedLocaleDict: Dictionary = $derived.by(() => {
	const newDict: Dictionary = structuredClone(fallbackLocaleDict);
	const walker = (part: Dictionary, target: Dictionary) => {
		for (const i in target) {
			const val = part[i];
			if (!val) continue;
			if (Array.isArray(val) || typeof val === 'object') {
				walker(val as Dictionary, target[i] as Dictionary);
			} else {
				target[i] = val;
			}
		}
	};
	walker('default' in currentLocaleDict ? currentLocaleDict.default : currentLocaleDict, newDict);
	return newDict;
});

/** Maps locale IDs with functions to either the dictionary or the function that will load the dictionary file. */
let localeMap: Record<string, (() => Promise<Dictionary>) | Dictionary> = $state.raw({
	...BUILTIN_MESSAGES
});

/** Current locale stored in cookie for server-side access. */
let currentLocale = $state<string>(bootstrapLocale);

if (browser) {
	applyDocumentLocale(bootstrapLocale);
}

/** Singleton i18n class for accessing translations */
class I18n {
	get dictionary(): Dictionary {
		return mergedLocaleDict;
	}

	get locale(): string {
		return currentLocale;
	}

	[key: string]: any;

	constructor() {
		return new Proxy(this, {
			get: (target, prop: string) => {
				if (prop === 'dictionary') return mergedLocaleDict;
				if (prop === 'locale') return currentLocale;
				return mergedLocaleDict[prop];
			}
		});
	}
}

export const i18n = new I18n();

/** Adds the given object as a preloaded dictionary */
export const addMessages = (code: string, messages: Dictionary) => {
	localeMap[code] = messages;
	localeMap = { ...localeMap };
};

/**
 * Registers a way to load a dictionary for the given locale code.
 * Usually it is a callback with a dynamic import or a fetch request.
 */
export const register = (code: string, registrar: () => Promise<Dictionary>) => {
	localeMap[code] = registrar;
	localeMap = { ...localeMap };
};

/** Loads the needed dictionary. */
const loadLocale = (code: string): Promise<Dictionary> | Dictionary => {
	if (code in localeMap) {
		const l = localeMap[code];
		if (l instanceof Function) {
			const promise = l();
			promise.then((dict: Dictionary) => (localeMap[code] = dict));
			return promise;
		}
		return l;
	}
	throw new Error(`No locale ${code} was defined.`);
};

/** Initializes i18n by loading all available languages */
export const initI18n = async (languages: Array<{ code: string; label: string }>) => {
	const availableLocales = languages.map((language) => language.code);

	for (const lang of languages) {
		const messages = BUILTIN_MESSAGES[lang.code as keyof typeof BUILTIN_MESSAGES];
		if (messages) {
			addMessages(lang.code, messages);
		}
	}

	const initialLocale = getInitialLocale(availableLocales);

	try {
		fallbackLocaleDict = await loadLocale(FALLBACK_LOCALE);
		currentLocaleDict = await loadLocale(initialLocale);
		setCookieLocale(initialLocale);
		applyDocumentLocale(initialLocale);
		currentLocale = initialLocale;
	} catch (error) {
		console.error('Failed to initialize i18n:', error);
	}
};

/** A function that must be called once when your app starts.
 * It initializes the dictionary with fallbackLocale, and then applies the initialLocale on top of it.
 */
export const init = async ({
	initialLocale,
	fallbackLocale
}: {
	initialLocale: string;
	fallbackLocale: string;
}) => {
	const resolvedFallbackLocale = fallbackLocale in localeMap ? fallbackLocale : FALLBACK_LOCALE;
	const resolvedInitialLocale = initialLocale in localeMap ? initialLocale : resolvedFallbackLocale;

	fallbackLocaleDict = loadLocale(resolvedFallbackLocale) as Dictionary;
	currentLocale = resolvedFallbackLocale;
	currentLocaleDict = await loadLocale(resolvedInitialLocale);
	setCookieLocale(resolvedInitialLocale);
	applyDocumentLocale(resolvedInitialLocale);
	currentLocale = resolvedInitialLocale;
};

/** Set the current locale */
export const setLocale = async (locale: string) => {
	currentLocaleDict = await loadLocale(locale);
	setCookieLocale(locale);
	applyDocumentLocale(locale);
	currentLocale = locale;
};

/** Get the current locale */
export const getLocale = () => currentLocale;

/** Lists IDs of all the available locales. */
export const getLocales = () => Object.keys(localeMap);

/** Derives the most suiting locale from navigator's information. */
export const getLocaleFromNavigator = (deflt: string) => {
	return deriveLocaleFromNavigator(deflt);
};

/**
 * Pure utility function to get localized string with fallback
 * Can be used client-side or server-side
 * @param localized - The LocalizedString object with de and en properties
 * @param locale - Optional locale ('de' | 'en'). If not provided, uses i18n.locale
 * @param fallbackLocale - Fallback locale if the desired locale is not available or empty
 */
export function getLocalized<T extends LocalizedString>(
	localized: T,
	locale?: 'de' | 'en',
	fallbackLocale: 'de' | 'en' = 'en'
): string {
	// Use i18n.locale if no locale is provided
	const requestedLocale =
		locale || (i18n.locale === 'de' || i18n.locale === 'en' ? i18n.locale : 'en');
	const validLocale =
		requestedLocale === 'de' || requestedLocale === 'en' ? requestedLocale : fallbackLocale;

	// Get the value for the requested locale
	const primaryValue = localized[validLocale];

	// If primary value exists and is not empty, return it
	if (primaryValue && primaryValue.trim() !== '') {
		return primaryValue;
	}

	// Otherwise, try the fallback locale
	const otherLocale = validLocale === 'de' ? 'en' : 'de';
	const fallbackValue = localized[otherLocale];

	// Return fallback if it exists, otherwise return empty string
	return fallbackValue && fallbackValue.trim() !== '' ? fallbackValue : primaryValue || '';
}
