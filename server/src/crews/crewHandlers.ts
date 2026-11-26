import { findChampionship } from '../../../shared/championshipRules';
import { type CrewDraft, sortCrewChampionships, validateCrewDraft } from '../../../shared/crewRules';
import { checkMembershipWithDiscord, type MembershipChecker, withAccess } from '../auth/authorizeRequest';
import { isCarAvailableIn } from '../cars/carRepository';
import { listChampionships } from '../championships/championshipRepository';
import { isUniqueConstraintError, type SqlDatabase } from '../database/sqlDatabase';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readIdList } from '../http/readIdList';
import { readJsonBody } from '../http/readJsonBody';
import {
  type CrewConflict,
  countCrewsInRaceResults,
  deleteCrews,
  findCrewById,
  findCrewConflict,
  insertCrew,
  listCrews,
  updateCrew,
} from './crewRepository';

const CONFLICT_ERROR_CODES = { number: 'duplicate-crew-number', name: 'duplicate-crew-name', role: 'duplicate-crew-role' } as const;

const conflictResponse = (conflict: Exclude<CrewConflict, null>) => errorResponse(409, CONFLICT_ERROR_CODES[conflict]);

type CrewDraftReading = { readonly crew: CrewDraft } | { readonly errorResponse: Response };

/**
 * Corpo della richiesta → equipaggio convalidato con le stesse regole dell'app; ogni campionato deve esistere
 * (si salva con il nome com'è scritto nel campionato) e ogni auto deve esservi ammessa.
 */
async function readCrewDraft(request: Request, database: SqlDatabase): Promise<CrewDraftReading> {
  const requestBody = await readJsonBody(request);
  if (requestBody === undefined) return { errorResponse: errorResponse(400, 'invalid-request') };

  const validation = validateCrewDraft(requestBody);
  if (!validation.isValid) return { errorResponse: errorResponse(422, 'invalid-crew', validation.issues) };
  const savedChampionships = await listChampionships(database);
  const championships = [];
  for (const entry of validation.crew.championships) {
    const championship = findChampionship(savedChampionships, entry.championship)?.name;
    if (!championship) return { errorResponse: errorResponse(422, 'invalid-crew', { championships: 'unknown-championship' }) };
    if (entry.carId !== null && !(await isCarAvailableIn(database, entry.carId, championship))) {
      return { errorResponse: errorResponse(422, 'invalid-crew', { championships: 'unknown-car' }) };
    }
    championships.push({ championship, carId: entry.carId });
  }
  return { crew: { ...validation.crew, championships: sortCrewChampionships(championships) } };
}

/**
 * Gestori delle richieste sugli equipaggi. Ognuno verifica prima utente e ruolo;
 * creazione e modifica poi ricontrollano i dati e l'unicità di numero e nome.
 * La verifica Discord è iniettabile per i test.
 */
export function createCrewHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord) {
  return {
    /** GET /crews — tutti gli equipaggi, per numero crescente. */
    listCrews: withAccess(checkMembership, 'any', async (_authorization, _request: Request, env: Env): Promise<Response> => {
      return jsonResponse(200, { crews: await listCrews(env.CREWS_DB) });
    }),

    /** GET /crews/:id */
    getCrew: withAccess(checkMembership, 'any', async (_authorization, _request: Request, env: Env, crewId: number): Promise<Response> => {
      const crew = await findCrewById(env.CREWS_DB, crewId);
      return crew ? jsonResponse(200, { crew }) : errorResponse(404, 'not-found');
    }),

    /** POST /crews — salva il nuovo equipaggio insieme a chi l'ha creato. */
    createCrew: withAccess(checkMembership, 'organization', async (authorization, request: Request, env: Env): Promise<Response> => {
      const reading = await readCrewDraft(request, env.CREWS_DB);
      if ('errorResponse' in reading) return reading.errorResponse;

      const conflict = await findCrewConflict(env.CREWS_DB, reading.crew);
      if (conflict) return conflictResponse(conflict);

      try {
        const savedCrew = await insertCrew(env.CREWS_DB, reading.crew, authorization.discordUserId);
        return jsonResponse(201, { crew: savedCrew });
      } catch (insertError) {
        // Due richieste quasi simultanee: il vincolo UNIQUE del database fa da ultima difesa.
        if (!isUniqueConstraintError(insertError)) throw insertError;
        return conflictResponse((await findCrewConflict(env.CREWS_DB, reading.crew)) ?? 'number');
      }
    }),

    /** PUT /crews/:id — numero e nome devono restare unici, escluso l'equipaggio stesso. */
    updateCrew: withAccess(checkMembership, 'organization', async (_authorization, request: Request, env: Env, crewId: number): Promise<Response> => {
      const reading = await readCrewDraft(request, env.CREWS_DB);
      if ('errorResponse' in reading) return reading.errorResponse;

      if (!(await findCrewById(env.CREWS_DB, crewId))) return errorResponse(404, 'not-found');

      const conflict = await findCrewConflict(env.CREWS_DB, reading.crew, crewId);
      if (conflict) return conflictResponse(conflict);

      try {
        const savedCrew = await updateCrew(env.CREWS_DB, crewId, reading.crew);
        return savedCrew ? jsonResponse(200, { crew: savedCrew }) : errorResponse(404, 'not-found');
      } catch (updateError) {
        if (!isUniqueConstraintError(updateError)) throw updateError;
        return conflictResponse((await findCrewConflict(env.CREWS_DB, reading.crew, crewId)) ?? 'number');
      }
    }),

    /** DELETE /crews con { "ids": [...] } — elimina gli equipaggi selezionati, tutti insieme. */
    deleteCrews: withAccess(checkMembership, 'organization', async (_authorization, request: Request, env: Env): Promise<Response> => {
      const crewIds = readIdList(await readJsonBody(request));
      if (!crewIds) return errorResponse(400, 'invalid-request');

      // Gli ordini di arrivo devono restare completi: prima si tolgono gli equipaggi dalle gare.
      if ((await countCrewsInRaceResults(env.CREWS_DB, crewIds)) > 0) return errorResponse(409, 'crew-in-race-results');

      return jsonResponse(200, { deletedCount: await deleteCrews(env.CREWS_DB, crewIds) });
    }),
  };
}

export type CrewHandlers = ReturnType<typeof createCrewHandlers>;
