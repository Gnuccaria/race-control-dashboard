import { invoke, isTauri } from '@tauri-apps/api/core';
import { DISCORD_CONFIG } from '@/config/discordConfig';

/** Il login con Discord richiede le funzioni native dell'app desktop. */
export const isDesktopApp = (): boolean => isTauri();

/** Testi della pagina che il browser mostra al termine dell'accesso, nella lingua dell'app. */
export interface BrowserCompletionPage {
  readonly title: string;
  readonly message: string;
}

/** Apre Discord nel browser di sistema e attende il ritorno sull'indirizzo locale. */
export function authorizeInBrowser(authorizeUrl: string, completionPage: BrowserCompletionPage): Promise<string> {
  return invoke<string>('authorize_in_browser', {
    authorizeUrl,
    redirectPort: DISCORD_CONFIG.redirectPort,
    completionPageTitle: completionPage.title,
    completionPageMessage: completionPage.message,
  });
}

export function cancelBrowserAuthorization(): Promise<void> {
  return invoke('cancel_browser_authorization');
}

/** Token di rinnovo nell'archivio sicuro del sistema operativo ("Ricorda l'accesso"). */
export function readSavedRefreshToken(): Promise<string | null> {
  return invoke<string | null>('read_refresh_token');
}

export function saveRefreshToken(refreshToken: string): Promise<void> {
  return invoke('save_refresh_token', { refreshToken });
}

export function deleteSavedRefreshToken(): Promise<void> {
  return invoke('delete_refresh_token');
}
