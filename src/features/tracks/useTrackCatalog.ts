import type { Track } from '@shared/raceRules';
import { useServerQuery } from '@/hooks/useServerQuery';
import { fetchTracks } from './trackApi';

/**
 * Piste lette dal server per il campo Tracciato. Come per le auto, vanno ricaricate (refresh)
 * ogni volta che l'utente apre la scelta del tracciato; nel frattempo restano visibili quelle già lette.
 */
export function useTrackCatalog() {
  const { queryState, reload } = useServerQuery('tracks', fetchTracks);
  const tracks: readonly Track[] = queryState.status === 'loaded' ? queryState.value : [];

  return {
    tracks,
    findTrack: (trackId: number | null) => (trackId === null ? undefined : tracks.find((track) => track.id === trackId)),
    isLoading: queryState.status === 'loading',
    errorKind: queryState.status === 'failed' ? queryState.errorKind : null,
    refresh: reload,
  };
}

export type TrackCatalog = ReturnType<typeof useTrackCatalog>;
