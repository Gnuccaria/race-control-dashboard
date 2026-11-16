/**
 * Lingua scelta dall'utente nella tendina ("system" = lingua del sistema operativo).
 * Store esterno a React, letto con useSyncExternalStore e salvato tra un avvio e l'altro.
 */
import { isSupportedLocale, type Locale } from './locales';

export type LanguagePreference = 'system' | Locale;

const LANGUAGE_PREFERENCE_STORAGE_KEY = 'app:language-preference';

function readStoredLanguagePreference(): LanguagePreference {
  try {
    const storedPreference = globalThis.localStorage?.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY);
    return isSupportedLocale(storedPreference) ? storedPreference : 'system';
  } catch {
    return 'system';
  }
}

function persistLanguagePreference(preference: LanguagePreference) {
  try {
    if (preference === 'system') globalThis.localStorage?.removeItem(LANGUAGE_PREFERENCE_STORAGE_KEY);
    else globalThis.localStorage?.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // Storage non disponibile: la scelta vale fino alla chiusura dell'app.
  }
}

let currentLanguagePreference = readStoredLanguagePreference();
const languagePreferenceListeners = new Set<() => void>();

export const getLanguagePreference = (): LanguagePreference => currentLanguagePreference;

export function setLanguagePreference(preference: LanguagePreference) {
  currentLanguagePreference = preference;
  persistLanguagePreference(preference);
  for (const listener of languagePreferenceListeners) listener();
}

export function subscribeToLanguagePreference(listener: () => void) {
  languagePreferenceListeners.add(listener);
  return () => {
    languagePreferenceListeners.delete(listener);
  };
}
