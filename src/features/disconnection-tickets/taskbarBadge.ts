import { isTauri } from '@tauri-apps/api/core';
import type { AppAccess } from '@/features/auth/model/discordProfile';
import { protestStore, unreadProtests } from '@/features/protests/protestStore';
import { ticketStore, unreadTickets } from './ticketStore';

/** Lato dell'immagine del pallino: Windows la mostra a 16 px, il doppio resta nitido sugli schermi ad alta densità. */
const BADGE_SIZE = 32;
const BADGE_COLOR = '#D93025';

/** Testo del pallino: il numero, oppure "9+" da 10 in su. */
export const badgeLabel = (count: number): string => (count > 9 ? '9+' : String(count));

/** Pallino rosso con il numero in bianco, come PNG. */
async function drawBadge(count: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = BADGE_SIZE;
  canvas.height = BADGE_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas non disponibile');
  context.fillStyle = BADGE_COLOR;
  context.beginPath();
  context.arc(BADGE_SIZE / 2, BADGE_SIZE / 2, BADGE_SIZE / 2, 0, Math.PI * 2);
  context.fill();
  const label = badgeLabel(count);
  context.fillStyle = '#FFFFFF';
  context.font = `700 ${label.length > 1 ? 17 : 22}px "Segoe UI", system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, BADGE_SIZE / 2, BADGE_SIZE / 2 + 1);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Pallino non disegnato');
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Mostra sull'icona dell'app nella barra delle applicazioni il numero delle notifiche non lette (la campanella):
 * su Windows un pallino rosso sovrapposto all'icona ("9+" da 10 in su), su macOS e Linux il contatore del sistema.
 * Ogni sistema ignora la chiamata che non supporta. Restituisce la funzione che smette di aggiornarlo e lo toglie.
 */
export function startTaskbarBadge(access: Pick<AppAccess, 'raceControl' | 'stewards'>): () => void {
  if (!isTauri()) return () => undefined;
  let shownCount = 0;
  let isStopped = false;
  let pending = Promise.resolve();

  const show = (count: number) => {
    pending = pending.then(async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.setOverlayIcon(count > 0 ? await drawBadge(count) : undefined).catch(() => undefined);
      await appWindow.setBadgeCount(count > 0 ? count : undefined).catch(() => undefined);
    }).catch((badgeError: unknown) => {
      console.warn('Impossibile aggiornare il pallino sull\'icona', badgeError);
    });
  };

  const update = () => {
    if (isStopped) return;
    const count =
      (access.raceControl ? unreadTickets(ticketStore.getState()).length : 0) + (access.stewards ? unreadProtests(protestStore.getState()).length : 0);
    if (count === shownCount) return;
    shownCount = count;
    show(count);
  };

  const unsubscribeTickets = ticketStore.subscribe(update);
  const unsubscribeProtests = protestStore.subscribe(update);
  update();
  return () => {
    isStopped = true;
    unsubscribeTickets();
    unsubscribeProtests();
    if (shownCount > 0) show(0);
    shownCount = 0;
  };
}
