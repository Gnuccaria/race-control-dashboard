/** Lingue preferite del sistema operativo, come le espone la WebView (navigator.languages). */

const EMPTY_LANGUAGE_LIST: readonly string[] = [];

/** Riferimento stabile finché la lista non cambia: requisito di useSyncExternalStore. */
let cachedLanguageKey = '';
let cachedLanguages: readonly string[] = EMPTY_LANGUAGE_LIST;

export function getSystemLanguages(): readonly string[] {
  const currentLanguages = globalThis.navigator?.languages ?? EMPTY_LANGUAGE_LIST;
  const currentLanguageKey = currentLanguages.join(',');
  if (currentLanguageKey !== cachedLanguageKey) {
    cachedLanguageKey = currentLanguageKey;
    cachedLanguages = [...currentLanguages];
  }
  return cachedLanguages;
}

/** Il sistema notifica il cambio di lingua con l'evento "languagechange". */
export function subscribeToSystemLanguages(listener: () => void) {
  window.addEventListener('languagechange', listener);
  return () => {
    window.removeEventListener('languagechange', listener);
  };
}
