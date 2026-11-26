import { readCarSourceMatches } from '../../../shared/carRules';
import { fieldsOf } from '../../../shared/valueRules';
import { checkMembershipWithDiscord, type MembershipChecker, withAccess } from '../auth/authorizeRequest';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readJsonBody } from '../http/readJsonBody';
import { defaultSourceFetch, loadRefreshSources, readRefreshFlags, type SourceFetch } from '../sources/externalSource';
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
import { fetchBopCars, fetchOfficialCars } from './carSources';

/**
 * Vetture: l'app le legge per menu e tabella; l'Organizzazione le aggiorna dai siti (catalogo ufficiale di GT7 e BoP
 * Midspeed di gt-engine.com). Lo scaricamento dei siti è iniettabile per i test.
 */
export function createCarHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord, fetchSource: SourceFetch = defaultSourceFetch) {
  return {
    /** GET /cars */
    listCars: withAccess(checkMembership, 'any', async (_authorization, _request: Request, env: Env): Promise<Response> => {
      return jsonResponse(200, { cars: await listCars(env.CREWS_DB) });
    }),

    /**
     * POST /cars/refresh con { matches?: [{ officialId, bopKey }], apply?: boolean, refetch?: boolean } — unisce le due
     * fonti (abbinamenti scelti a mano compresi) e risponde con l'anteprima; con apply: true salva anche (le auto si
     * ritrovano senza perdere equipaggi e gare collegati) e ricorda gli abbinamenti scelti a mano.
     * Le fonti si scaricano solo con refetch (di default sì; l'app lo chiede con "Aggiorna dati") e restano salvate:
     * ricalcolo dell'anteprima e salvataggio le riusano, così usano gli stessi dati visti nell'anteprima e restano
     * leggeri (i Worker hanno un limite di tempo di calcolo per richiesta).
     */
    refreshCars: withAccess(checkMembership, 'organization', async (authorization, request: Request, env: Env): Promise<Response> => {
      const body = await readJsonBody(request);
      const candidate = fieldsOf(body);
      const requestedMatches = readCarSourceMatches(candidate.matches);
      const flags = readRefreshFlags(candidate);
      if (body === undefined || !requestedMatches || !flags) return errorResponse(400, 'invalid-request');

      const sources = await loadRefreshSources<StagedCarSources>({
        refetch: flags.refetch,
        readStaged: () => readStagedSources(env.CREWS_DB),
        fetchFresh: async () => {
          const [official, bop] = await Promise.all([fetchOfficialCars(fetchSource), fetchBopCars(fetchSource)]);
          return { official, bop: bop.cars, bopVersion: bop.version };
        },
        saveStaged: (fresh) => saveStagedSources(env.CREWS_DB, fresh, authorization.discordUserId),
        logLabel: 'Aggiornamento vetture',
        errorCodes: { unreachable: 'car-source-unreachable', changed: 'car-source-changed' },
      });
      if (sources instanceof Response) return sources;
      const matches = combineMatches(await listSavedMatches(env.CREWS_DB), requestedMatches);
      const merged = mergeCarSources(sources.official, sources.bop, matches);
      const plan = planCarRefresh(merged.cars, await listStoredCars(env.CREWS_DB));
      const preview = describeCarRefresh(plan, merged, sources.bopVersion);
      if (!flags.apply) return jsonResponse(200, { preview });

      try {
        await applyCarRefresh(env.CREWS_DB, plan, requestedMatches);
      } catch (applyError) {
        console.error('Salvataggio delle vetture non riuscito', applyError);
        throw applyError;
      }
      return jsonResponse(200, { preview, cars: await listCars(env.CREWS_DB) });
    }),
  };
}
