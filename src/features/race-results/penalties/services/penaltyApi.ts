import type { PenaltyDraft, SavedPenalty } from '@shared/penaltyRules';
import { readDeletedCount, requestServerApi } from '@/services/serverApi';

const readPenalty = (responseBody: unknown) => (responseBody as { penalty: SavedPenalty }).penalty;
const readPenalties = (responseBody: unknown) => (responseBody as { penalties: SavedPenalty[] }).penalties;
const penaltiesPath = (raceId: number) => `/races/${raceId}/penalties`;

export const fetchPenalties = (raceId: number) => requestServerApi({ method: 'GET', path: penaltiesPath(raceId) }, readPenalties);

export const fetchPenalty = (raceId: number, penaltyId: number) =>
  requestServerApi({ method: 'GET', path: `${penaltiesPath(raceId)}/${penaltyId}` }, readPenalty);

export const createPenalty = (raceId: number, penalty: PenaltyDraft) =>
  requestServerApi({ method: 'POST', path: penaltiesPath(raceId), body: penalty }, readPenalty);

export const updatePenalty = (raceId: number, penaltyId: number, penalty: PenaltyDraft) =>
  requestServerApi({ method: 'PUT', path: `${penaltiesPath(raceId)}/${penaltyId}`, body: penalty }, readPenalty);

const readReprimandCounts = (responseBody: unknown) =>
  new Map((responseBody as { counts: { crewId: number; count: number }[] }).counts.map(({ crewId, count }) => [crewId, count]));

/** Reprimende di ogni vettura già date prima di una penalità esistente (o di una nuova, senza beforePenaltyId). */
export const fetchReprimandCounts = (raceId: number, beforePenaltyId: number | null) =>
  requestServerApi(
    { method: 'GET', path: `/races/${raceId}/reprimands${beforePenaltyId === null ? '' : `?before=${beforePenaltyId}`}` },
    readReprimandCounts,
  );

/** Elimina più penalità della gara in una sola operazione. */
export const deletePenalties = (raceId: number, penaltyIds: readonly number[]) =>
  requestServerApi({ method: 'DELETE', path: penaltiesPath(raceId), body: { ids: penaltyIds } }, readDeletedCount);
