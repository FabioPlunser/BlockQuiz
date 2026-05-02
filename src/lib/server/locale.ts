const SUPPORTED_LOCALES = ['en', 'de'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const DEFAULT_LOCALE: SupportedLocale = 'en';

export function isSupportedLocale(value: string | undefined): value is SupportedLocale {
	return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

export function getLocaleFromAcceptLanguage(header: string | null): SupportedLocale {
	if (!header) return DEFAULT_LOCALE;

	for (const part of header.toLowerCase().split(',')) {
		const locale = part.trim().split(';')[0]?.split('-')[0];
		if (isSupportedLocale(locale)) {
			return locale;
		}
	}

	return DEFAULT_LOCALE;
}

export function getRequestLocale(event: {
	cookies: { get(name: string): string | undefined };
	request: Request;
}) {
	const cookieLocale = event.cookies.get('i18n-locale');

	return isSupportedLocale(cookieLocale)
		? cookieLocale
		: getLocaleFromAcceptLanguage(event.request.headers.get('accept-language'));
}
