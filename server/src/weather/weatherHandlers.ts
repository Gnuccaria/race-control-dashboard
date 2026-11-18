import { readWeatherPattern } from '../../../shared/weatherRules';
import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readJsonBody } from '../http/readJsonBody';
import { findRaceSummaryById } from '../races/raceRepository';
import { findRaceWeather, saveRaceWeather } from './weatherRepository';

/** Corpo massimo del pattern: 24 stint × 9 codici e la qualifica stanno larghi in 8 KB. */
const MAX_WEATHER_BODY_BYTES = 8_192;

/** Pattern meteo delle gare: lo leggono tutti i ruoli dell'app, lo salva il Direttore Gara (Strumenti pre-gara). */
export function createWeatherHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord) {
  return {
    /** GET /races/:id/weather — { weather: { stintCount, pattern } } */
    async getWeather(request: Request, env: Env, raceId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'any');
      if (authorization instanceof Response) return authorization;
      const race = await findRaceSummaryById(env.CREWS_DB, raceId);
      if (!race) return errorResponse(404, 'not-found');
      return jsonResponse(200, { weather: await findRaceWeather(env.CREWS_DB, race) });
    },

    /** PUT /races/:id/weather con { pattern } — qualifica (2 slot) e ogni stint della gara (9 slot), tutti compilati. */
    async saveWeather(request: Request, env: Env, raceId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'raceControl');
      if (authorization instanceof Response) return authorization;
      const race = await findRaceSummaryById(env.CREWS_DB, raceId);
      if (!race) return errorResponse(404, 'not-found');
      const body = (await readJsonBody(request, MAX_WEATHER_BODY_BYTES)) as { pattern?: unknown } | undefined;
      if (body === undefined) return errorResponse(400, 'invalid-request');
      const weather = await findRaceWeather(env.CREWS_DB, race);
      const pattern = readWeatherPattern(body.pattern, weather.stintCount);
      if (!pattern) return errorResponse(422, 'invalid-weather', { stintCount: weather.stintCount });
      await saveRaceWeather(env.CREWS_DB, raceId, pattern, authorization.discordUserId);
      return jsonResponse(200, { weather: { stintCount: weather.stintCount, pattern } });
    },
  };
}
