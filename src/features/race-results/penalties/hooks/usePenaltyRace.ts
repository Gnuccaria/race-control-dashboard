import { useParams } from 'react-router';
import { fetchCrews } from '@/features/crews/services/crewApi';
import { useServerQuery } from '@/hooks/useServerQuery';
import { findChampionshipCrews } from '../../model/raceDraft';
import { fetchRace } from '../../services/raceApi';
import { fetchReprimandCounts } from '../services/penaltyApi';

const ID_PATTERN = /^\d{1,9}$/;

/** Gara dell'URL (…/:raceId/penalita/…) con le vetture del suo campionato: servono a entrambe le pagine delle penalità. */
export function usePenaltyRace() {
  const { raceId: raceIdText = '', penaltyId: penaltyIdText = '' } = useParams();
  const raceId = ID_PATTERN.test(raceIdText) ? Number(raceIdText) : null;
  const penaltyId = ID_PATTERN.test(penaltyIdText) ? Number(penaltyIdText) : null;

  const raceQuery = useServerQuery(`race-${raceIdText}`, async () =>
    raceId === null ? ({ isSuccess: false, errorKind: 'not-found' } as const) : fetchRace(raceId),
  );
  const { queryState: crewsQuery } = useServerQuery('crews', fetchCrews);
  // Reprimende già date prima di questa penalità (o di una nuova): servono a numerare quella che si sta scegliendo.
  const { queryState: reprimandCountsQuery } = useServerQuery(`race-${raceIdText}-reprimands-${penaltyIdText}`, async () =>
    raceId === null ? ({ isSuccess: false, errorKind: 'not-found' } as const) : fetchReprimandCounts(raceId, penaltyId),
  );
  const race = raceQuery.queryState.status === 'loaded' ? raceQuery.queryState.value : null;
  const allCrews = crewsQuery.status === 'loaded' ? crewsQuery.value : null;

  return {
    raceId,
    penaltyId,
    raceQuery,
    crewsQuery,
    race,
    allCrews,
    championshipCrews: race && allCrews ? findChampionshipCrews(allCrews, race.championship) : null,
    reprimandCountsBefore: reprimandCountsQuery.status === 'loaded' ? reprimandCountsQuery.value : undefined,
  };
}

/** Dal form della penalità al dettaglio della gara, con la scheda Penalità aperta. */
export const BACK_TO_RACE_PENALTIES = '../..?scheda=penalita';
