import type { RaceDraft, RaceSummary, SavedRace } from '@shared/raceRules';
import { readDeletedCount, requestServerApi } from '@/services/serverApi';

const readRace = (responseBody: unknown) => (responseBody as { race: SavedRace }).race;
const readRaces = (responseBody: unknown) => (responseBody as { races: RaceSummary[] }).races;

export const fetchRaces = () => requestServerApi({ method: 'GET', path: '/races' }, readRaces);

export const fetchRace = (raceId: number) => requestServerApi({ method: 'GET', path: `/races/${raceId}` }, readRace);

export const createRace = (race: RaceDraft) => requestServerApi({ method: 'POST', path: '/races', body: race }, readRace);

export const updateRace = (raceId: number, race: RaceDraft) =>
  requestServerApi({ method: 'PUT', path: `/races/${raceId}`, body: race }, readRace);

/** Solo i cambi pilota di una gara già creata (Gestisci cambi pilota dei Commissari Sportivi). */
export const updateRaceDriverSwaps = (raceId: number, driverSwaps: RaceDraft['driverSwaps']) =>
  requestServerApi({ method: 'PUT', path: `/races/${raceId}/driver-swaps`, body: { driverSwaps } }, readRace);

/** Elimina più gare (con le loro classifiche) in una sola operazione. */
export const deleteRaces = (raceIds: readonly number[]) =>
  requestServerApi({ method: 'DELETE', path: '/races', body: { ids: raceIds } }, readDeletedCount);
