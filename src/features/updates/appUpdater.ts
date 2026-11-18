import { isTauri } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

/** Avanzamento dello scaricamento: byte scaricati e totali (null se il server non dice la dimensione). */
export interface UpdateProgress {
  readonly version: string;
  readonly downloadedBytes: number;
  readonly totalBytes: number | null;
  readonly phase: 'downloading' | 'installing';
}

/** Tempo massimo per sapere se c'è una versione nuova: senza rete l'app si apre lo stesso. */
const CHECK_TIMEOUT_MS = 10_000;

/** Solo nell'app installata: nel browser e in sviluppo (npm run desktop:dev) non si aggiorna nulla. */
export const canUpdateApp = (): boolean => isTauri() && !import.meta.env.DEV;

/**
 * Aggiornamento all'avvio, senza chiedere: se su GitHub c'è una versione più recente (firmata con la chiave del
 * progetto), la scarica, la installa e riavvia l'app. onProgress riceve l'avanzamento per la barra. Restituisce
 * false se non c'è niente da installare o se qualcosa non va (rete assente, firma non valida…): l'app si apre lo stesso.
 */
export async function installAvailableUpdate(onProgress: (progress: UpdateProgress) => void): Promise<boolean> {
  try {
    const update = await check({ timeout: CHECK_TIMEOUT_MS });
    if (!update) return false;
    let downloadedBytes = 0;
    let totalBytes: number | null = null;
    onProgress({ version: update.version, downloadedBytes, totalBytes, phase: 'downloading' });
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') totalBytes = event.data.contentLength ?? null;
      if (event.event === 'Progress') downloadedBytes += event.data.chunkLength;
      onProgress({ version: update.version, downloadedBytes, totalBytes, phase: event.event === 'Finished' ? 'installing' : 'downloading' });
    });
    // Su Windows l'installatore chiude l'app da solo e la riapre; altrove la si riavvia qui.
    await relaunch();
    return true;
  } catch (updateError) {
    console.error('Aggiornamento dell\'app non riuscito', updateError);
    return false;
  }
}
