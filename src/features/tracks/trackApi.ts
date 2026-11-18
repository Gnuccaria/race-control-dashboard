import type { Track } from '@shared/raceRules';
import type { LegacyTrackMatch, TrackMapMatch, TrackRefreshPreview } from '@shared/trackRules';
import { requestServerApi } from '@/services/serverApi';

/** Piste salvate sul server (tabella tracks): una per configurazione. */
export const fetchTracks = () =>
  requestServerApi({ method: 'GET', path: '/tracks' }, (responseBody) => (responseBody as { tracks: Track[] }).tracks);

/**
 * Aggiornamento dai siti (wiki di Gran Turismo e mappe di gt-engine.com): il server li scarica e risponde con
 * l'anteprima; con apply: true salva anche e restituisce i tracciati aggiornati. refetch: false riusa i dati già
 * scaricati dall'ultimo "Aggiorna dati" (ricalcolo dell'anteprima e invio).
 */
export const refreshTracks = (body: { readonly mapMatches: readonly TrackMapMatch[]; readonly legacyMatches: readonly LegacyTrackMatch[]; readonly apply: boolean; readonly refetch: boolean }) =>
  requestServerApi({ method: 'POST', path: '/tracks/refresh', body }, (responseBody) => responseBody as { preview: TrackRefreshPreview; tracks?: Track[] });
