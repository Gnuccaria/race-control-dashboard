import { readCarSourceMatches } from '../../../shared/carRules';
import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readJsonBody } from '../http/readJsonBody';
import {
  applyCarRefresh,
  combineMatches,
  describeCarRefresh,
  listSavedMatches,
  listStoredCars,
  mergeCarSources,
  planCarRefresh,
  readStagedSources,
  saveStagedSources,
  type StagedCarSources,
} from './carRefresh';
import { listCars } from './carRepository';
import { CarSourceError, fetchBopCars, fetchOfficialCars, type SourceFetch } from './carSources';

const defaultSourceFetch: SourceFetch = (url, init) => fetch(url, init);

/**
 * Vetture: l'app le legge per menu e tabella; l'Organizzazione le aggiorna dai siti (catalogo ufficiale di GT7 e BoP
 * Midspeed di gt-engine.com). Lo scaricamento dei siti è iniettabile per i test.
 */
export function createCarHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord, fetchSource: SourceFetch = defaultSourceFetch) {
  return {
    /** GET /cars */
    async listCars(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'any');
      if (authorization instanceof Response) return authorization;
      return jsonResponse(200, { cars: await listCars(env.CREWS_DB) });
    },

    /**
     * POST /cars/refresh con { matches?: [{ officialId, bopKey }], apply?: boolean, refetch?: boolean } — unisce le due
     * fonti (abbinamenti scelti a mano compresi) e risponde con l'anteprima; con apply: true salva anche (le auto si
     * ritrovano senza perdere equipaggi e gare collegati) e ricorda gli abbinamenti scelti a mano.
     * Le fonti si scaricano solo con refetch (di default sì; l'app lo chiede con "Aggiorna dati") e restano salvate:
     * ricalcolo dell'anteprima e salvataggio le riusano, così usano gli stessi dati visti nell'anteprima e restano
     * leggeri (i Worker hanno un limite di tempo di calcolo per richiesta).
     */
    async refreshCars(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;
      const body = await readJsonBody(request);
      const candidate = (typeof body === 'object' && body !== null ? body : {}) as { matches?: unknown; apply?: unknown; refetch?: unknown };
      const requestedMatches = readCarSourceMatches(candidate.matches);
      const isBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
      if (body === undefined || !requestedMatches || !isBoolean(candidate.apply) || !isBoolean(candidate.refetch)) {
        return errorResponse(400, 'invalid-request');
      }

      let sources = candidate.refetch === false ? await readStagedSources(env.CREWS_DB) : null;
      if (!sources) {
        try {
          const [official, bop] = await Promise.all([fetchOfficialCars(fetchSource), fetchBopCars(fetchSource)]);
          sources = { official, bop: bop.cars, bopVersion: bop.version } satisfies StagedCarSources;
        } catch (sourceError) {
          if (!(sourceError instanceof CarSourceError)) throw sourceError;
          console.error('Aggiornamento vetture', sourceError.source, sourceError.reason, sourceError.message);
          return errorResponse(502, sourceError.reason === 'unreachable' ? 'car-source-unreachable' : 'car-source-changed', { source: sourceError.source });
        }
        await saveStagedSources(env.CREWS_DB, sources, authorization.discordUserId);
      }
      const matches = combineMatches(await listSavedMatches(env.CREWS_DB), requestedMatches);
      const merged = mergeCarSources(sources.official, sources.bop, matches);
      const plan = planCarRefresh(merged.cars, await listStoredCars(env.CREWS_DB));
      const preview = describeCarRefresh(plan, merged, sources.bopVersion);
      if (candidate.apply !== true) return jsonResponse(200, { preview });

      try {
        await applyCarRefresh(env.CREWS_DB, plan, requestedMatches);
      } catch (applyError) {
        console.error('Salvataggio delle vetture non riuscito', applyError);
        throw applyError;
      }
      return jsonResponse(200, { preview, cars: await listCars(env.CREWS_DB) });
    },
  };
}
