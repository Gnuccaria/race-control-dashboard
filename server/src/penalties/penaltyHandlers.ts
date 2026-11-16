import { type PenaltyDraft, type SavedPenalty, validatePenaltyDraft } from '../../../shared/penaltyRules';
import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import type { SqlDatabase } from '../database/sqlDatabase';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readIdList } from '../http/readIdList';
import { MAX_PENALTY_BODY_BYTES, readJsonBody } from '../http/readJsonBody';
import { findRaceSummaryById, hasCrewsOutside } from '../races/raceRepository';
import { translatePenaltyToEnglish } from '../translation/penaltyTranslation';
import {
  countReprimandsBefore,
  deletePenalties,
  type EnglishTextToSave,
  findPenalty,
  insertPenalty,
  listPenalties,
  updatePenalty,
} from './penaltyRepository';

type PenaltyDraftReading = { readonly penalty: PenaltyDraft } | { readonly errorResponse: Response };

/** Corpo della richiesta → penalità convalidata; le vetture coinvolte devono partecipare al campionato della gara. */
async function readPenaltyDraft(request: Request, database: SqlDatabase, championship: string): Promise<PenaltyDraftReading> {
  const requestBody = await readJsonBody(request, MAX_PENALTY_BODY_BYTES);
  if (requestBody === undefined) return { errorResponse: errorResponse(400, 'invalid-request') };

  const validation = validatePenaltyDraft(requestBody);
  if (!validation.isValid) return { errorResponse: errorResponse(422, 'invalid-penalty', validation.issues) };
  if (await hasCrewsOutside(database, championship, validation.penalty.crews.map((crew) => crew.crewId))) {
    return { errorResponse: errorResponse(422, 'invalid-penalty', { crews: 'unknown-crew' }) };
  }
  return { penalty: validation.penalty };
}

/** Traduzione automatica da salvare (null se non riuscita). */
async function translateAutomatically(env: Env, penalty: PenaltyDraft): Promise<EnglishTextToSave> {
  const english = await translatePenaltyToEnglish(env.AI, penalty.reason);
  return english ? { ...english, source: 'automatic', isOutdated: false } : null;
}

/**
 * Traduzione dopo una modifica:
 * - corretta a mano nell'app → si salva così;
 * - "rifai la traduzione" (null) → di nuovo in automatico;
 * - motivazione originale cambiata → una traduzione automatica si rifà, una corretta a mano resta ma va ricontrollata;
 * - altrimenti resta quella che c'era.
 */
async function englishTextAfterUpdate(env: Env, saved: SavedPenalty, penalty: PenaltyDraft): Promise<EnglishTextToSave> {
  if (penalty.englishText) return { ...penalty.englishText, source: 'manual', isOutdated: false };
  if (penalty.englishText === null) return translateAutomatically(env, penalty);
  if (penalty.reason === '') return translateAutomatically(env, penalty);
  const isTextChanged = saved.reason !== penalty.reason;
  if (!isTextChanged) return saved.english;
  if (saved.english?.source === 'manual') return { ...saved.english, isOutdated: true };
  return translateAutomatically(env, penalty);
}

/** Gestori delle penalità di una gara (/races/:raceId/penalties…): ognuno verifica prima utente e ruolo. */
export function createPenaltyHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord) {
  return {
    /** GET /races/:raceId/penalties */
    async listPenalties(request: Request, env: Env, raceId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;
      if (!(await findRaceSummaryById(env.CREWS_DB, raceId))) return errorResponse(404, 'not-found');
      return jsonResponse(200, { penalties: await listPenalties(env.CREWS_DB, raceId) });
    },

    /** POST /races/:raceId/penalties */
    async createPenalty(request: Request, env: Env, raceId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;

      const race = await findRaceSummaryById(env.CREWS_DB, raceId);
      if (!race) return errorResponse(404, 'not-found');
      const reading = await readPenaltyDraft(request, env.CREWS_DB, race.championship);
      if ('errorResponse' in reading) return reading.errorResponse;
      const english = await translateAutomatically(env, reading.penalty);
      return jsonResponse(201, { penalty: await insertPenalty(env.CREWS_DB, raceId, reading.penalty, english, authorization.discordUserId) });
    },

    /** DELETE /races/:raceId/penalties con { "ids": [...] } */
    async deletePenalties(request: Request, env: Env, raceId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;

      const penaltyIds = readIdList(await readJsonBody(request));
      if (!penaltyIds) return errorResponse(400, 'invalid-request');
      return jsonResponse(200, { deletedCount: await deletePenalties(env.CREWS_DB, raceId, penaltyIds) });
    },

    /**
     * GET /races/:raceId/reprimands[?before=penaltyId] — per ogni vettura, quante reprimende ha già prima di questa
     * penalità (o prima di una nuova): il form mostra così quale reprimenda sarebbe (1ª, 2ª o 3ª del ciclo).
     */
    async countReprimands(request: Request, env: Env, raceId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;
      if (!(await findRaceSummaryById(env.CREWS_DB, raceId))) return errorResponse(404, 'not-found');

      const beforeText = new URL(request.url).searchParams.get('before');
      if (beforeText !== null && !/^\d{1,9}$/.test(beforeText)) return errorResponse(400, 'invalid-request');
      const counts = await countReprimandsBefore(env.CREWS_DB, raceId, beforeText === null ? null : Number(beforeText));
      return jsonResponse(200, { counts: [...counts].map(([crewId, count]) => ({ crewId, count })) });
    },

    /** GET /races/:raceId/penalties/:penaltyId */
    async getPenalty(request: Request, env: Env, raceId: number, penaltyId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;

      const penalty = await findPenalty(env.CREWS_DB, raceId, penaltyId);
      return penalty ? jsonResponse(200, { penalty }) : errorResponse(404, 'not-found');
    },

    /** PUT /races/:raceId/penalties/:penaltyId */
    async updatePenalty(request: Request, env: Env, raceId: number, penaltyId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;

      const race = await findRaceSummaryById(env.CREWS_DB, raceId);
      const saved = race ? await findPenalty(env.CREWS_DB, raceId, penaltyId) : null;
      if (!race || !saved) return errorResponse(404, 'not-found');
      const reading = await readPenaltyDraft(request, env.CREWS_DB, race.championship);
      if ('errorResponse' in reading) return reading.errorResponse;

      const english = await englishTextAfterUpdate(env, saved, reading.penalty);
      const savedPenalty = await updatePenalty(env.CREWS_DB, raceId, penaltyId, reading.penalty, english);
      return savedPenalty ? jsonResponse(200, { penalty: savedPenalty }) : errorResponse(404, 'not-found');
    },
  };
}
