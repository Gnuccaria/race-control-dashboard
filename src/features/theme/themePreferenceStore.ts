/**
 * Store esterno a React per la preferenza di tema, letto con useSyncExternalStore.
 * Nessun Provider necessario: qualsiasi componente può leggerlo o modificarlo.
 */
import { syncDesktopWindowTheme } from './desktopWindowTheme';

export type ThemePreference = 'system' | 'light' | 'dark';

/** La stessa chiave è letta dallo script inline in index.html, che applica il tema prima del primo paint. */
export const THEME_PREFERENCE_STORAGE_KEY = 'app:theme-preference';

const MANUAL_THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark'];

function readStoredThemePreference(): ThemePreference {
  try {
    const storedPreference = globalThis.localStorage?.getItem(THEME_PREFERENCE_STORAGE_KEY);
    return MANUAL_THEME_PREFERENCES.find((preference) => preference === storedPreference) ?? 'system';
  } catch {
    return 'system';
  }
}

function persistThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') globalThis.localStorage?.removeItem(THEME_PREFERENCE_STORAGE_KEY);
    else globalThis.localStorage?.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // Storage non disponibile: la scelta vale fino alla chiusura della pagina.
  }
}

/**
 * Con "system" non forza nulla: valgono le impostazioni del dispositivo.
 * Nell'app desktop aggiorna anche la barra del titolo della finestra.
 */
export function applyThemePreference(preference: ThemePreference) {
  const rootElement = document.documentElement;
  if (preference === 'system') delete rootElement.dataset.theme;
  else rootElement.dataset.theme = preference;
  syncDesktopWindowTheme(preference);
}

let currentThemePreference = readStoredThemePreference();
const themePreferenceListeners = new Set<() => void>();

const notifyThemePreferenceListeners = () => {
  for (const listener of themePreferenceListeners) listener();
};

export const getThemePreference = (): ThemePreference => currentThemePreference;

export function setThemePreference(preference: ThemePreference) {
  currentThemePreference = preference;
  persistThemePreference(preference);
  applyThemePreference(preference);
  notifyThemePreferenceListeners();
}

/** Mantiene allineate anche le altre schede aperte sul sito. */
function syncThemePreferenceFromOtherTab(storageEvent: StorageEvent) {
  if (storageEvent.key !== THEME_PREFERENCE_STORAGE_KEY) return;
  currentThemePreference = readStoredThemePreference();
  applyThemePreference(currentThemePreference);
  notifyThemePreferenceListeners();
}

export function subscribeToThemePreference(listener: () => void) {
  if (themePreferenceListeners.size === 0) window.addEventListener('storage', syncThemePreferenceFromOtherTab);
  themePreferenceListeners.add(listener);

  return () => {
    themePreferenceListeners.delete(listener);
    if (themePreferenceListeners.size === 0) window.removeEventListener('storage', syncThemePreferenceFromOtherTab);
  };
}
