import { useSyncExternalStore } from 'react';
import { getSystemPrefersDarkColorScheme, subscribeToSystemColorScheme } from './systemColorScheme';
import { getThemePreference, setThemePreference, subscribeToThemePreference } from './themePreferenceStore';

const enableNightMode = (isEnabled: boolean) => {
  setThemePreference(isEnabled ? 'dark' : 'light');
};

const followSystemColorScheme = () => {
  setThemePreference('system');
};

/** Tema effettivo dell'interfaccia: scelta manuale se presente, altrimenti quella del dispositivo. */
export function useColorTheme() {
  const themePreference = useSyncExternalStore(subscribeToThemePreference, getThemePreference);
  const systemPrefersDark = useSyncExternalStore(subscribeToSystemColorScheme, getSystemPrefersDarkColorScheme);

  return {
    isNightModeActive: themePreference === 'dark' || (themePreference === 'system' && systemPrefersDark),
    isFollowingSystem: themePreference === 'system',
    enableNightMode,
    followSystemColorScheme,
  };
}
