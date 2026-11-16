import type { CrewDraft, SavedCrew } from '@shared/crewRules';
import { readDeletedCount, requestServerApi } from '@/services/serverApi';

const readCrew = (responseBody: unknown) => (responseBody as { crew: SavedCrew }).crew;
const readCrews = (responseBody: unknown) => (responseBody as { crews: SavedCrew[] }).crews;

export const fetchCrews = () => requestServerApi({ method: 'GET', path: '/crews' }, readCrews);

export const fetchCrew = (crewId: number) => requestServerApi({ method: 'GET', path: `/crews/${crewId}` }, readCrew);

export const createCrew = (crew: CrewDraft) => requestServerApi({ method: 'POST', path: '/crews', body: crew }, readCrew);

export const updateCrew = (crewId: number, crew: CrewDraft) =>
  requestServerApi({ method: 'PUT', path: `/crews/${crewId}`, body: crew }, readCrew);

/** Elimina più equipaggi in una sola operazione; restituisce quanti ne sono stati eliminati. */
export const deleteCrews = (crewIds: readonly number[]) =>
  requestServerApi({ method: 'DELETE', path: '/crews', body: { ids: crewIds } }, readDeletedCount);
