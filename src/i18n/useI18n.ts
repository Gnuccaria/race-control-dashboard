import { useSyncExternalStore } from 'react';
import { getLanguagePreference, subscribeToLanguagePreference } from './languagePreferenceStore';
import { detectSystemLocale, type Locale } from './locales';
import { MESSAGES_BY_LOCALE } from './messages';
import { getNumberFormatters } from './numberFormatting';
import { getSystemLanguages, subscribeToSystemLanguages } from './systemLanguages';

/** Lingua effettiva: quella scelta nella tendina, altrimenti quella del sistema operativo. */
export function useLocale(): Locale {
  const languagePreference = useSyncExternalStore(subscribeToLanguagePreference, getLanguagePreference);
  const systemLanguages = useSyncExternalStore(subscribeToSystemLanguages, getSystemLanguages);
  return languagePreference === 'system' ? detectSystemLocale(systemLanguages) : languagePreference;
}

/** Testi e formattazione dei numeri nella lingua corrente. */
export function useI18n() {
  const locale = useLocale();
  return { locale, messages: MESSAGES_BY_LOCALE[locale], ...getNumberFormatters(locale) };
}
