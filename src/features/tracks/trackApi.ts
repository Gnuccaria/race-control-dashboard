import type { Track } from '@shared/raceRules';
import { requestServerApi } from '@/services/serverApi';

/** Piste salvate sul server (tabella tracks): una per configurazione. */
export const fetchTracks = () =>
  requestServerApi({ method: 'GET', path: '/tracks' }, (responseBody) => (responseBody as { tracks: Track[] }).tracks);
