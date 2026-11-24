import { driverSwapCountOf } from '../../../shared/championshipRules';
import { readDriverSwaps } from '../../../shared/driverSwapRules';
import { type RaceDraft, resolveResultCars, type SavedRaceResult, validateRaceDraft } from '../../../shared/raceRules';
import type { SavedQualifyingEntry } from '../../../shared/qualifyingRules';
import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import { isUniqueConstraintError, type SqlDatabase } from '../database/sqlDatabase';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readIdList } from '../http/readIdList';
import { MAX_RACE_BODY_BYTES, readJsonBody } from '../http/readJsonBody';
import { listChampionships } from '../championships/championshipRepository';
import { findTrackById } from '../tracks/trackRepository';
import {
  deleteRaces,
  findCrewCarIds,
  findRaceById,
  hasCrewsOutside,
  hasCrewsOutsideChampionship,
  insertRace,
  isRaceRoundTaken,
  listRaceQualifying,
  listRaceResults,
  listRaces,
  replaceDriverSwaps,
  updateRace,
} from './raceRepository';

type RaceDraftReading =
  | { readonly race: RaceDraft; readonly results: readonly SavedRaceResult[]; readonly qualifying: readonly SavedQualifyingEntry[] }
  | { readonly errorResponse: Response };

/**
 * Corpo della richiesta → gara convalidata: stesse regole dell'app, più i controlli che solo il server
 * può fare (il campionato esiste con quella durata, la pista esiste, gli equipaggi esistono e partecipano al campionato, il round è libero).
 * Decide anche la vettura di ogni riga (resolveResultCars): le righe rimaste uguali tengono quella già
 * salvata, le altre prendono l'auto attuale dell'equipaggio, che quindi deve averne una.
 */
async function readRaceDraft(request: Request, database: SqlDatabase, excludedRaceId?: number): Promise<RaceDraftReading> {
  const requestBody = await readJsonBody(request, MAX_RACE_BODY_BYTES);
  if (requestBody === undefined) return { errorResponse: errorResponse(400, 'invalid-request') };

  const validation = validateRaceDraft(requestBody, await listChampionships(database));
  if (!validation.isValid) return { errorResponse: errorResponse(422, 'invalid-race', validation.issues) };
  const { race } = validation;

  if (race.trackId !== null) {
    const track = await findTrackById(database, race.trackId);
    if (!track) return { errorResponse: errorResponse(422, 'invalid-race', { trackId: 'unknown-track' }) };
    if (race.isTrackReversed && track.hasReverseLayout !== true) {
      return { errorResponse: errorResponse(422, 'invalid-race', { trackId: 'reverse-unavailable' }) };
    }
  }
  if (await hasCrewsOutsideChampionship(database, race)) {
    return { errorResponse: errorResponse(422, 'invalid-race', { results: 'unknown-crew' }) };
  }
  if (await isRaceRoundTaken(database, race, excludedRaceId)) {
    return { errorResponse: errorResponse(409, 'duplicate-race-round') };
  }

  const savedResults = excludedRaceId === undefined ? [] : await listRaceResults(database, excludedRaceId);
  const currentCarIds = await findCrewCarIds(database, race.results.map((result) => result.crewId), race.championship);
  const { carIdByPosition, positionsWithoutCar } = resolveResultCars(race.results, savedResults, currentCarIds);
  if (positionsWithoutCar.length > 0) {
    return { errorResponse: errorResponse(422, 'invalid-race', { results: 'crew-without-car', positions: positionsWithoutCar }) };
  }
  const results = race.results.map((result) => ({ ...result, carId: carIdByPosition.get(result.position) ?? null }));

  // Qualifiche: stessa regola per la vettura di ogni riga. Senza il campo (app non ancora aggiornata) restano quelle salvate.
  const savedQualifying = excludedRaceId === undefined ? [] : await listRaceQualifying(database, excludedRaceId);
  const hasQualifying = typeof requestBody === 'object' && requestBody !== null && 'qualifying' in requestBody;
  if (!hasQualifying) return { race: { ...race, qualifying: savedQualifying }, results, qualifying: savedQualifying };
  const qualifyingCarIds = await findCrewCarIds(database, race.qualifying.map((entry) => entry.crewId), race.championship);
  const qualifyingCars = resolveResultCars(race.qualifying, savedQualifying, qualifyingCarIds);
  if (qualifyingCars.positionsWithoutCar.length > 0) {
    return { errorResponse: errorResponse(422, 'invalid-race', { qualifying: 'crew-without-car', positions: qualifyingCars.positionsWithoutCar }) };
  }
  const qualifying = race.qualifying.map((entry) => ({ ...entry, carId: qualifyingCars.carIdByPosition.get(entry.position) ?? null }));
  return { race, results, qualifying };
}

/** Gestori delle richieste sulle gare: ognuno verifica prima utente e ruolo, come per gli equipaggi. */
export function createRaceHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord) {
  return {
    /** GET /races — tutte le gare, dalle più recenti. */
    async listRaces(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'any');
      if (authorization instanceof Response) return authorization;
      return jsonResponse(200, { races: await listRaces(env.CREWS_DB) });
    },

    /** GET /races/:id — gara con ordine di arrivo. */
    async getRace(request: Request, env: Env, raceId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'any');
      if (authorization instanceof Response) return authorization;

      const race = await findRaceById(env.CREWS_DB, raceId);
      return race ? jsonResponse(200, { race }) : errorResponse(404, 'not-found');
    },

    /** POST /races */
    async createRace(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;

      const reading = await readRaceDraft(request, env.CREWS_DB);
      if ('errorResponse' in reading) return reading.errorResponse;

      try {
        return jsonResponse(201, { race: await insertRace(env.CREWS_DB, reading.race, reading.results, reading.qualifying, authorization.discordUserId) });
      } catch (insertError) {
        // Due richieste quasi simultanee per lo stesso round: il vincolo UNIQUE fa da ultima difesa.
        if (!isUniqueConstraintError(insertError)) throw insertError;
        return errorResponse(409, 'duplicate-race-round');
      }
    },

    /** PUT /races/:id — sostituisce dati e ordine di arrivo (Organizzazione); i cambi pilota restano quelli salvati. */
    async updateRace(request: Request, env: Env, raceId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;

      if (!(await findRaceById(env.CREWS_DB, raceId))) return errorResponse(404, 'not-found');
      const reading = await readRaceDraft(request, env.CREWS_DB, raceId);
      if ('errorResponse' in reading) return reading.errorResponse;

      try {
        const savedRace = await updateRace(env.CREWS_DB, raceId, reading.race, reading.results, reading.qualifying, true);
        return savedRace ? jsonResponse(200, { race: savedRace }) : errorResponse(404, 'not-found');
      } catch (updateError) {
        if (!isUniqueConstraintError(updateError)) throw updateError;
        return errorResponse(409, 'duplicate-race-round');
      }
    },

    /**
     * PUT /races/:id/driver-swaps con { driverSwaps } — solo i cambi pilota di una gara già creata (Commissari
     * Sportivi): stesse regole della gara intera (numero di cambi dagli stint della durata, equipaggi del campionato).
     */
    async updateDriverSwaps(request: Request, env: Env, raceId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'stewards');
      if (authorization instanceof Response) return authorization;

      const race = await findRaceById(env.CREWS_DB, raceId);
      if (!race) return errorResponse(404, 'not-found');
      const body = (await readJsonBody(request, MAX_RACE_BODY_BYTES)) as { driverSwaps?: unknown } | undefined;
      const driverSwaps = readDriverSwaps(body?.driverSwaps, driverSwapCountOf(await listChampionships(env.CREWS_DB), race.championship, race.duration));
      if (!driverSwaps) return errorResponse(422, 'invalid-race', { driverSwaps: 'invalid' });
      if (await hasCrewsOutside(env.CREWS_DB, race.championship, driverSwaps.map((driverSwap) => driverSwap.crewId))) {
        return errorResponse(422, 'invalid-race', { driverSwaps: 'unknown-crew' });
      }
      const savedRace = await replaceDriverSwaps(env.CREWS_DB, raceId, driverSwaps);
      return savedRace ? jsonResponse(200, { race: savedRace }) : errorResponse(404, 'not-found');
    },

    /** DELETE /races con { "ids": [...] } — elimina le gare selezionate con le loro classifiche. */
    async deleteRaces(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;

      const raceIds = readIdList(await readJsonBody(request));
      if (!raceIds) return errorResponse(400, 'invalid-request');
      return jsonResponse(200, { deletedCount: await deleteRaces(env.CREWS_DB, raceIds) });
    },
  };
}

export type RaceHandlers = ReturnType<typeof createRaceHandlers>;
