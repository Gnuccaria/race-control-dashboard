import { readCarSourceMatches } from '../../../shared/carRules';
import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readJsonBody } from '../http/readJsonBody';
import { applyCarRefresh, combineMatches, describeCarRefresh, listSavedMatches, listStoredCars, mergeCarSources, planCarRefresh } from './carRefresh';
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
     * POST /cars/refresh con { matches?: [{ officialId, bopKey }], apply?: boolean } — scarica le due fonti, unisce i
     * dati (abbinamenti scelti a mano compresi) e risponde con l'anteprima; con apply: true salva anche (le auto si
     * ritrovano senza perdere equipaggi e gare collegati) e ricorda gli abbinamenti scelti a mano.
     */
    async refreshCars(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;
      const body = await readJsonBody(request);
      const candidate = (typeof body === 'object' && body !== null ? body : {}) as { matches?: unknown; apply?: unknown };
      const requestedMatches = readCarSourceMatches(candidate.matches);
      if (body === undefined || !requestedMatches || (candidate.apply !== undefined && typeof candidate.apply !== 'boolean')) {
        return errorResponse(400, 'invalid-request');
      }

      let sources: [Awaited<ReturnType<typeof fetchOfficialCars>>, Awaited<ReturnType<typeof fetchBopCars>>];
      try {
        sources = await Promise.all([fetchOfficialCars(fetchSource), fetchBopCars(fetchSource)]);
      } catch (sourceError) {
        if (!(sourceError instanceof CarSourceError)) throw sourceError;
        console.error('Aggiornamento vetture', sourceError.source, sourceError.reason, sourceError.message);
        return errorResponse(502, sourceError.reason === 'unreachable' ? 'car-source-unreachable' : 'car-source-changed', { source: sourceError.source });
      }
      const [official, bop] = sources;
      const matches = combineMatches(await listSavedMatches(env.CREWS_DB), requestedMatches);
      const merged = mergeCarSources(official, bop.cars, matches);
      const plan = planCarRefresh(merged.cars, await listStoredCars(env.CREWS_DB));
      const preview = describeCarRefresh(plan, merged, bop.version);
      if (candidate.apply !== true) return jsonResponse(200, { preview });

      await applyCarRefresh(env.CREWS_DB, plan, requestedMatches);
      return jsonResponse(200, { preview, cars: await listCars(env.CREWS_DB) });
    },
  };
}
