import { isTauri } from '@tauri-apps/api/core';
import type { ThemePreference } from './themePreferenceStore';

/**
 * Nell'app desktop allinea anche la barra del titolo nativa al tema scelto
 * (null = segue il sistema). Nel browser non fa nulla.
 */
export function syncDesktopWindowTheme(preference: ThemePreference) {
  if (!isTauri()) return;

  import('@tauri-apps/api/window')
    .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(preference === 'system' ? null : preference))
    .catch((windowThemeError: unknown) => {
      console.warn('Impossibile aggiornare il tema della finestra', windowThemeError);
    });
}
