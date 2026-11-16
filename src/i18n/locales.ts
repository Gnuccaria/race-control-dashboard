export const SUPPORTED_LOCALES = ['it', 'en', 'fr', 'de'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Lingua usata quando quella del sistema operativo non è tra quelle supportate. */
export const FALLBACK_LOCALE: Locale = 'en';

/** Ogni lingua è scritta nella lingua stessa, così è riconoscibile da chi la parla. */
export const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
};

/** Etichetta BCP 47 completa per Intl (separatori decimali, ecc.). */
export const LOCALE_FORMATTING_TAGS: Record<Locale, string> = {
  it: 'it-IT',
  en: 'en-GB',
  fr: 'fr-FR',
  de: 'de-DE',
};

export function isSupportedLocale(value: unknown): value is Locale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

/** Prima lingua preferita del sistema che l'app supporta (es. "de-CH" → "de"). */
export function detectSystemLocale(preferredLanguages: readonly string[]): Locale {
  for (const languageTag of preferredLanguages) {
    const baseLanguage = languageTag.toLowerCase().split('-')[0];
    if (isSupportedLocale(baseLanguage)) return baseLanguage;
  }
  return FALLBACK_LOCALE;
}
