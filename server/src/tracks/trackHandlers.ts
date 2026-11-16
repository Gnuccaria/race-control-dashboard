import { normalizeTrackName } from '../../../shared/raceRules';
import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import { isUniqueConstraintError } from '../database/sqlDatabase';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readJsonBody } from '../http/readJsonBody';
import { insertTrack, isTrackNameTaken, listTracks } from './trackRepository';

/** Piste: elenco (usato dall'app quando si crea una gara) e inserimento di una nuova pista. */
export function createTrackHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord) {
  return {
    /** GET /tracks — tutte le piste in ordine alfabetico. */
    async listTracks(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'any');
      if (authorization instanceof Response) return authorization;
      return jsonResponse(200, { tracks: await listTracks(env.CREWS_DB) });
    },

    /** POST /tracks con { "name": "..." } — il nome deve essere valido e non già usato. */
    async createTrack(request: Request, env: Env): Promise<Response> {
      // Nuovi tracciati dal form della gara (Organizzazione) o dal calcolatore disconnessioni (Direzione Gara).
      const authorization = await authorizeRequest(request, env, checkMembership, ['organization', 'raceControl']);
      if (authorization instanceof Response) return authorization;

      const requestBody = await readJsonBody(request);
      if (requestBody === undefined) return errorResponse(400, 'invalid-request');
      const name = normalizeTrackName((requestBody as { name?: unknown } | null)?.name);
      if (!name) return errorResponse(422, 'invalid-track');
      if (await isTrackNameTaken(env.CREWS_DB, name)) return errorResponse(409, 'duplicate-track');

      try {
        return jsonResponse(201, { track: await insertTrack(env.CREWS_DB, name) });
      } catch (insertError) {
        if (!isUniqueConstraintError(insertError)) throw insertError;
        return errorResponse(409, 'duplicate-track');
      }
    },
  };
}

export type TrackHandlers = ReturnType<typeof createTrackHandlers>;
