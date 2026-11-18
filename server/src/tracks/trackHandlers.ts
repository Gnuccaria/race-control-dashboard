import { readLegacyTrackMatches, readTrackMapMatches } from '../../../shared/trackRules';
import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { MAX_CHAMPIONSHIP_BODY_BYTES, readJsonBody } from '../http/readJsonBody';
import {
  applyTrackRefresh,
  combineMapMatches,
  describeTrackRefresh,
  listSavedMapMatches,
  planTrackRefresh,
  readStagedTrackSources,
  saveStagedTrackSources,
  type StagedTrackSources,
} from './trackRefresh';
import { listStoredTracks, listTracks } from './trackRepository';
import { attachTrackMaps, fetchTrackMaps, fetchWikiTracks, type SourceFetch, TrackSourceError } from './trackSources';

/**
 * Tracciati: elenco (scelta del tracciato di gare e calcolatore disconnessioni) e aggiornamento dai siti. Non si
 * aggiungono a mano: arrivano solo dal wiki di Gran Turismo, con le mappe di gt-engine.com.
 */
export function createTrackHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord, fetchSource: SourceFetch = (url, init) => fetch(url, init)) {
  return {
    /** GET /tracks — tutte le configurazioni in ordine alfabetico. */
    async listTracks(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'any');
      if (authorization instanceof Response) return authorization;
      return jsonResponse(200, { tracks: await listTracks(env.CREWS_DB) });
    },

    /**
     * POST /tracks/refresh con { mapMatches?: [{ sourceKey, mapFile }], legacyMatches?: [{ trackId, sourceKey }],
     * apply?: boolean, refetch?: boolean } — unisce le due fonti (abbinamenti scelti a mano compresi) e risponde con
     * l'anteprima; con apply: true salva anche (le gare restano collegate) e ricorda le mappe scelte a mano.
     * Le fonti si scaricano solo con refetch (di default sì) e restano salvate: ricalcolo e salvataggio le riusano.
     */
    async refreshTracks(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership);
      if (authorization instanceof Response) return authorization;
      const body = await readJsonBody(request, MAX_CHAMPIONSHIP_BODY_BYTES);
      const candidate = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
      const mapMatches = readTrackMapMatches(candidate.mapMatches);
      const legacyMatches = readLegacyTrackMatches(candidate.legacyMatches);
      const isBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
      if (body === undefined || !mapMatches || !legacyMatches || !isBoolean(candidate.apply) || !isBoolean(candidate.refetch)) {
        return errorResponse(400, 'invalid-request');
      }

      let sources = candidate.refetch === false ? await readStagedTrackSources(env.CREWS_DB) : null;
      if (!sources) {
        try {
          const [layouts, maps] = await Promise.all([fetchWikiTracks(fetchSource), fetchTrackMaps(fetchSource)]);
          sources = { layouts, maps } satisfies StagedTrackSources;
        } catch (sourceError) {
          if (!(sourceError instanceof TrackSourceError)) throw sourceError;
          console.error('Aggiornamento tracciati', sourceError.source, sourceError.reason, sourceError.message);
          return errorResponse(502, sourceError.reason === 'unreachable' ? 'track-source-unreachable' : 'track-source-changed', { source: sourceError.source });
        }
        await saveStagedTrackSources(env.CREWS_DB, sources, authorization.discordUserId);
      }
      const attached = attachTrackMaps(sources.layouts, sources.maps, combineMapMatches(await listSavedMapMatches(env.CREWS_DB), mapMatches));
      const plan = planTrackRefresh(attached.layouts, await listStoredTracks(env.CREWS_DB), legacyMatches);
      const preview = describeTrackRefresh(plan, attached);
      if (candidate.apply !== true) return jsonResponse(200, { preview });

      await applyTrackRefresh(env.CREWS_DB, plan, mapMatches);
      return jsonResponse(200, { preview, tracks: await listTracks(env.CREWS_DB) });
    },
  };
}
