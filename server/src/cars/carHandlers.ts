import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import type { Env } from '../env';
import { jsonResponse } from '../http/jsonResponse';
import { listCars } from './carRepository';

/** Auto: l'app le legge ogni volta che deve mostrare un menu delle auto. */
export function createCarHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord) {
  return {
    /** GET /cars */
    async listCars(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'any');
      if (authorization instanceof Response) return authorization;
      return jsonResponse(200, { cars: await listCars(env.CREWS_DB) });
    },
  };
}
