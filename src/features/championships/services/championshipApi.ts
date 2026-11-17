import type { Championship, ChampionshipDraft } from '@shared/championshipRules';
import { readDeletedCount, requestServerApi } from '@/services/serverApi';

const readChampionship = (responseBody: unknown) => (responseBody as { championship: Championship }).championship;
const readChampionships = (responseBody: unknown) => (responseBody as { championships: Championship[] }).championships;

export const fetchChampionships = () => requestServerApi({ method: 'GET', path: '/championships' }, readChampionships);

export const fetchChampionship = (championshipId: number) =>
  requestServerApi({ method: 'GET', path: `/championships/${championshipId}` }, readChampionship);

export const createChampionship = (championship: ChampionshipDraft) =>
  requestServerApi({ method: 'POST', path: '/championships', body: championship }, readChampionship);

export const updateChampionship = (championshipId: number, championship: ChampionshipDraft) =>
  requestServerApi({ method: 'PUT', path: `/championships/${championshipId}`, body: championship }, readChampionship);

/** Elimina più campionati in una sola operazione (tutti o nessuno); restituisce quanti ne sono stati eliminati. */
export const deleteChampionships = (championshipIds: readonly number[]) =>
  requestServerApi({ method: 'DELETE', path: '/championships', body: { ids: championshipIds } }, readDeletedCount);
