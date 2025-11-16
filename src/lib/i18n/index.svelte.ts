
import { PersistedState } from 'runed';

type Dictionary = Record<string, any>;

/** The loaded locale dictionary. */
let currentLocaleDict: Dictionary = $state.raw({});
/** The dictionary which keys will be used if they are not present in the currentLocaleDict. */
let fallbackLocaleDict: Dictionary = $state.raw({});
/** Precalculated, merged dictionary that will be used in your components. */
let mergedLocaleDict: Dictionary = $derived.by(() => {
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
let localeMap: Record<string, (() => Promise<Dictionary>) | Dictionary> = $state.raw({});

/** Persisted current locale ID. */
const persistedLocale = new PersistedState<string>('i18n-locale', '', { storage: 'local' });
let currentLocale = $derived.by(() => persistedLocale.current);

/** Singleton i18n class for accessing translations */
class I18n {
  get dictionary(): Dictionary {
    return mergedLocaleDict;
  }

  get locale(): string {
    return persistedLocale.current;
  }

  [key: string]: any;

  constructor() {
    return new Proxy(this, {
      get: (target, prop: string) => {
        if (prop === 'dictionary') return mergedLocaleDict;
        if (prop === 'locale') return persistedLocale.current;
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
  const languageMap: Record<string, () => Promise<Dictionary>> = {};

  for (const lang of languages) {
    languageMap[lang.code] = () => import(`./${lang.code}.json`).then(m => m.default || m);
  }

  // Register all languages
  for (const [code, loader] of Object.entries(languageMap)) {
    register(code, loader as () => Promise<Dictionary>);
  }

  // Get saved locale from persisted state, or use first language in list
  let initialLocale: string;
  if (persistedLocale.current && languages.some(l => l.code === persistedLocale.current)) {
    initialLocale = persistedLocale.current;
  } else {
    initialLocale = languages[0]?.code || 'en';
  }

  const fallbackLocale = 'en';

  try {
    fallbackLocaleDict = await loadLocale(fallbackLocale);
    persistedLocale.current = fallbackLocale;
    currentLocaleDict = await loadLocale(initialLocale);
    persistedLocale.current = initialLocale;
  } catch (error) {
    console.error('Failed to initialize i18n:', error);
  }
};

/** A function that must be called once when your app starts.
 * It initializes the dictionary with fallbackLocale, and then applies the initialLocale on top of it.
 */
export const init = async ({ initialLocale, fallbackLocale }: { initialLocale: string; fallbackLocale: string }) => {
  fallbackLocaleDict = loadLocale(fallbackLocale) as Dictionary;
  currentLocale = fallbackLocale;
  currentLocaleDict = await loadLocale(initialLocale);
  currentLocale = initialLocale;
};

/** Set the current locale */
export const setLocale = async (locale: string) => {
  currentLocaleDict = await loadLocale(locale);
  persistedLocale.current = locale;
};

/** Get the current locale */
export const getLocale = () => persistedLocale.current;

/** Lists IDs of all the available locales. */
export const getLocales = () => Object.keys(localeMap);

/** Derives the most suiting locale from navigator's information. */
export const getLocaleFromNavigator = (deflt: string) => {
  if (navigator.language in localeMap) {
    return navigator.language;
  }
  if (navigator.language.includes('-')) {
    const [firstPart] = navigator.language.split('-');
    if (firstPart in localeMap) {
      return firstPart;
    }
  }
  // No locale loaded; use the existing one
  return deflt;
};
