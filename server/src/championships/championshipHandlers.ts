import { type ChampionshipDraft, validateChampionshipDraft } from '../../../shared/championshipRules';
import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import { findExistingCarIds } from '../cars/carRepository';
import { isUniqueConstraintError, type SqlDatabase } from '../database/sqlDatabase';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readIdList } from '../http/readIdList';
import { MAX_CHAMPIONSHIP_BODY_BYTES, readJsonBody } from '../http/readJsonBody';
import {
  countChampionshipRaces,
  deleteChampionships,
  findCarsUsedByCrews,
  findChampionshipById,
  insertChampionship,
  isChampionshipNameTaken,
  listChampionships,
  listUsedDurations,
  updateChampionship,
} from './championshipRepository';

type ChampionshipDraftReading = { readonly championship: ChampionshipDraft } | { readonly errorResponse: Response };

/** Corpo della richiesta → campionato convalidato con le regole dell'app; le vetture devono essere del catalogo. */
async function readChampionshipDraft(request: Request, database: SqlDatabase): Promise<ChampionshipDraftReading> {
  const requestBody = await readJsonBody(request, MAX_CHAMPIONSHIP_BODY_BYTES);
  if (requestBody === undefined) return { errorResponse: errorResponse(400, 'invalid-request') };
  const validation = validateChampionshipDraft(requestBody);
  if (!validation.isValid) return { errorResponse: errorResponse(422, 'invalid-championship', validation.issues) };
  const existingCarIds = await findExistingCarIds(database, validation.championship.carIds);
  if (existingCarIds.length !== validation.championship.carIds.length) {
    return { errorResponse: errorResponse(422, 'invalid-championship', { carIds: 'unknown-car' }) };
  }
  return { championship: validation.championship };
}

/**
 * Campionati: tutti gli utenti dell'app li leggono (menu di gare ed equipaggi, cambi pilota);
 * solo l'Organizzazione li crea, modifica ed elimina.
 */
export function createChampionshipHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord) {
  return {
    /** GET /championships — in ordine alfabetico. */
    async listChampionships(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'any');
      if (authorization instanceof Response) return authorization;
      return jsonResponse(200, { championships: await listChampionships(env.CREWS_DB) });
    },

    /** GET /championships/:id */
    async getChampionship(request: Request, env: Env, championshipId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'any');
      if (authorization instanceof Response) return authorization;
      const championship = await findChampionshipById(env.CREWS_DB, championshipId);
      return championship ? jsonResponse(200, { championship }) : errorResponse(404, 'not-found');
    },

    /** POST /championships — il nome deve essere unico. */
    async createChampionship(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;
      const reading = await readChampionshipDraft(request, env.CREWS_DB);
      if ('errorResponse' in reading) return reading.errorResponse;
      if (await isChampionshipNameTaken(env.CREWS_DB, reading.championship.name)) return errorResponse(409, 'duplicate-championship-name');
      try {
        return jsonResponse(201, { championship: await insertChampionship(env.CREWS_DB, reading.championship, authorization.discordUserId) });
      } catch (insertError) {
        if (!isUniqueConstraintError(insertError)) throw insertError;
        return errorResponse(409, 'duplicate-championship-name');
      }
    },

    /**
     * PUT /championships/:id — il nome resta unico e passa a gare ed equipaggi collegati. Una durata usata da qualche
     * gara non si può togliere né cambiare di stint (cambierebbero i cambi pilota già salvati); una vettura usata
     * da almeno un equipaggio del campionato non si può togliere.
     */
    async updateChampionship(request: Request, env: Env, championshipId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;
      const reading = await readChampionshipDraft(request, env.CREWS_DB);
      if ('errorResponse' in reading) return reading.errorResponse;
      const previous = await findChampionshipById(env.CREWS_DB, championshipId);
      if (!previous) return errorResponse(404, 'not-found');
      if (await isChampionshipNameTaken(env.CREWS_DB, reading.championship.name, championshipId)) return errorResponse(409, 'duplicate-championship-name');

      const usedHours = await listUsedDurations(env.CREWS_DB, previous.name);
      const changedUsedHours = usedHours.filter((hours) => {
        const before = previous.durations.find((duration) => duration.hours === hours);
        const after = reading.championship.durations.find((duration) => duration.hours === hours);
        return !after || (before !== undefined && before.stintMinutes !== after.stintMinutes);
      });
      if (changedUsedHours.length > 0) return errorResponse(409, 'championship-duration-in-use', { hours: changedUsedHours.sort((first, second) => first - second) });
      const removedCarIds = previous.carIds.filter((carId) => !reading.championship.carIds.includes(carId));
      const usedCarIds = removedCarIds.length > 0 ? await findCarsUsedByCrews(env.CREWS_DB, previous.name, removedCarIds) : [];
      if (usedCarIds.length > 0) return errorResponse(409, 'championship-car-in-use', { carIds: usedCarIds });

      try {
        const savedChampionship = await updateChampionship(env.CREWS_DB, previous, reading.championship);
        return savedChampionship ? jsonResponse(200, { championship: savedChampionship }) : errorResponse(404, 'not-found');
      } catch (updateError) {
        if (!isUniqueConstraintError(updateError)) throw updateError;
        return errorResponse(409, 'duplicate-championship-name');
      }
    },

    /**
     * DELETE /championships con { "ids": [...] } — tutti o nessuno: non si elimina un campionato con gare salvate.
     * Gli equipaggi collegati perdono il campionato (chi non ne ha altri resta senza).
     */
    async deleteChampionships(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;
      const championshipIds = readIdList(await readJsonBody(request));
      if (!championshipIds) return errorResponse(400, 'invalid-request');
      const championships = (await Promise.all(championshipIds.map((championshipId) => findChampionshipById(env.CREWS_DB, championshipId)))).filter(
        (championship) => championship !== null,
      );
      for (const championship of championships) {
        if ((await countChampionshipRaces(env.CREWS_DB, championship.name)) > 0) return errorResponse(409, 'championship-has-races');
      }
      await deleteChampionships(env.CREWS_DB, championships);
      return jsonResponse(200, { deletedCount: championships.length });
    },
  };
}
