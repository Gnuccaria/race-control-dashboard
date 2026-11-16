import { type TicketCrewProblem } from '../../../shared/disconnectionTicketRules';
import { CREW_CHAMPIONSHIPS } from '../../../shared/crewRules';
import {
  isProtestVideoExpired,
  isProtestVideoType,
  isProtestVideoWindowOpen,
  MAX_PROTESTS_PER_DAY,
  PROTEST_VIDEO_MAX_BYTES,
  validateProtestDraft,
  validateProtestReview,
  youtubeVideoIdFrom,
} from '../../../shared/protestRules';
import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import type { Env, VideoBucket } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readJsonBody } from '../http/readJsonBody';
import { authorizeSiteMember, type DiscordFetch, type SiteMember } from '../siteAuth/siteDiscordAuth';
import { findTicketCrewFromRoles } from '../tickets/ticketCrewFromRoles';
import {
  attachProtestVideo,
  attachProtestYoutube,
  countRecentProtestsBy,
  findProtest,
  findProtestUploadState,
  findProtestVideo,
  findProtestVisibleTo,
  findVisibleProtestVideo,
  insertProtest,
  listChampionshipCrews,
  listCrewsOfChampionships,
  listProtests,
  listProtestsVisibleTo,
  type ProtestViewer,
  reviewProtest,
} from './protestRepository';

/** Descrizione fino a 1000 caratteri (anche accentati o emoji) più gli altri campi. */
const MAX_PROTEST_BODY_BYTES = 16_384;

const crewProblemResponse = (problem: TicketCrewProblem) =>
  problem === 'bot-unavailable' ? errorResponse(503, 'bot-unavailable') : errorResponse(422, problem);

const viewerOf = (member: SiteMember): ProtestViewer => ({ discordUserId: member.profile.id, roleIds: member.roleIds });

/** Il video dal bucket, se c'è ancora: passati 30 giorni dall'invio è scaduto (410), anche se R2 non l'ha ancora cancellato. */
async function videoResponse(bucket: VideoBucket | undefined, video: { readonly videoKey: string | null; readonly createdAt: string } | null): Promise<Response> {
  if (!video?.videoKey) return errorResponse(404, 'not-found');
  if (isProtestVideoExpired(video.createdAt)) return errorResponse(410, 'video-expired');
  const object = await bucket?.get(video.videoKey);
  if (!object) return errorResponse(410, 'video-expired');
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Content-Length': String(object.size),
      'Cache-Control': 'private, no-store',
    },
  });
}

/**
 * Proteste.
 *   GET  /public/protests/form          equipaggio di chi è entrato (dal ruolo Discord) e gli altri equipaggi dei campionati (sito)
 *   POST /public/protests               invio dal sito; l'equipaggio lo ricava il server dal ruolo → { protest: { id } }
 *   GET  /public/protests/mine          proteste di chi è entrato e del suo equipaggio (stesso ruolo), con l'esito
 *   GET  /public/protests/:id           una di quelle proteste
 *   PUT  /public/protests/:id/video     video (corpo = file; Content-Type e Content-Length), entro 24 ore, da chi l'ha mandata
 *   PUT  /public/protests/:id/youtube   { youtubeUrl }, alle stesse condizioni
 *   GET  /public/protests/:id/video     il video, per chi può vedere la protesta
 *   GET  /protests                      tutte le proteste (app, Commissari Sportivi)
 *   GET  /protests/:id                  una protesta (app)
 *   GET  /protests/:id/video            il suo video (app)
 *   PUT  /protests/:id/review           { isRejected, reason }: esito della protesta (app)
 */
export function createProtestHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord, discordFetch: DiscordFetch = fetch) {
  /** Chi ha mandato la protesta, entro 24 ore dall'invio: può ancora aggiungere un video o il link YouTube. */
  async function checkVideoAddition(env: Env, protestId: number, member: SiteMember, kind: 'video' | 'youtube'): Promise<Response | null> {
    const state = await findProtestUploadState(env.CREWS_DB, protestId);
    if (!state || state.submittedBy !== member.profile.id) return errorResponse(404, 'not-found');
    if (kind === 'video' ? state.hasVideo : state.hasYoutube) return errorResponse(409, kind === 'video' ? 'video-already-uploaded' : 'youtube-already-added');
    if (!isProtestVideoWindowOpen(state.createdAt)) return errorResponse(409, 'upload-expired');
    return null;
  }

  return {
    async getForm(request: Request, env: Env): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;
      const lookup = await findTicketCrewFromRoles(discordFetch, env, env.CREWS_DB, member.roleIds);
      if (!('crew' in lookup)) return crewProblemResponse(lookup.problem);
      const otherCrews = await listCrewsOfChampionships(env.CREWS_DB, CREW_CHAMPIONSHIPS, lookup.crew.id);
      return jsonResponse(200, { crew: lookup.crew, otherCrews });
    },

    async submitProtest(request: Request, env: Env): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;
      const validation = validateProtestDraft(await readJsonBody(request, MAX_PROTEST_BODY_BYTES));
      if (!validation.isValid) return errorResponse(422, 'invalid-protest', validation.issues);
      const lookup = await findTicketCrewFromRoles(discordFetch, env, env.CREWS_DB, member.roleIds);
      if (!('crew' in lookup)) return crewProblemResponse(lookup.problem);
      const { profile } = member;
      if ((await countRecentProtestsBy(env.CREWS_DB, profile.id)) >= MAX_PROTESTS_PER_DAY) return errorResponse(429, 'too-many-protests');

      // Gli altri equipaggi devono essere del campionato scelto (e non il proprio).
      const championshipCrews = await listChampionshipCrews(env.CREWS_DB, validation.protest.championship, lookup.crew.id);
      const otherCrews = validation.protest.otherCrewIds.map((crewId) => championshipCrews.find((crew) => crew.id === crewId));
      if (otherCrews.some((crew) => crew === undefined)) return errorResponse(422, 'invalid-protest', { otherCrewIds: 'invalid' });

      const protestId = await insertProtest(env.CREWS_DB, validation.protest, {
        crew: lookup.crew,
        crewRoleId: lookup.roleId,
        otherCrews: otherCrews.filter((crew) => crew !== undefined),
        discordUserId: profile.id,
        displayName: profile.displayName,
        username: profile.username,
      });
      return jsonResponse(201, { protest: { id: protestId } });
    },

    async listMyProtests(request: Request, env: Env): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;
      return jsonResponse(200, { protests: await listProtestsVisibleTo(env.CREWS_DB, viewerOf(member)) });
    },

    async getMyProtest(request: Request, env: Env, protestId: number): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;
      const protest = await findProtestVisibleTo(env.CREWS_DB, protestId, viewerOf(member));
      return protest ? jsonResponse(200, { protest }) : errorResponse(404, 'not-found');
    },

    async getMyProtestVideo(request: Request, env: Env, protestId: number): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;
      return videoResponse(env.PROTEST_VIDEOS, await findVisibleProtestVideo(env.CREWS_DB, protestId, viewerOf(member)));
    },

    async uploadVideo(request: Request, env: Env, protestId: number): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;
      const bucket = env.PROTEST_VIDEOS;
      if (!bucket) return errorResponse(503, 'video-storage-unavailable');
      const refusal = await checkVideoAddition(env, protestId, member, 'video');
      if (refusal) return refusal;

      const contentType = (request.headers.get('Content-Type') ?? '').split(';')[0]?.trim().toLowerCase();
      const size = Number(request.headers.get('Content-Length'));
      if (!isProtestVideoType(contentType) || !Number.isInteger(size) || size <= 0 || !request.body) return errorResponse(422, 'invalid-video');
      if (size > PROTEST_VIDEO_MAX_BYTES) return errorResponse(413, 'video-too-large');

      const videoKey = `protests/${protestId}/${crypto.randomUUID()}`;
      await bucket.put(videoKey, request.body, { httpMetadata: { contentType } });
      if (!(await attachProtestVideo(env.CREWS_DB, protestId, videoKey, contentType, size))) {
        await bucket.delete(videoKey);
        return errorResponse(409, 'video-already-uploaded');
      }
      return jsonResponse(200, { video: { contentType, size } });
    },

    async addYoutube(request: Request, env: Env, protestId: number): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;
      const refusal = await checkVideoAddition(env, protestId, member, 'youtube');
      if (refusal) return refusal;
      const body = (await readJsonBody(request).catch(() => null)) as { youtubeUrl?: unknown } | null;
      const youtubeVideoId = typeof body?.youtubeUrl === 'string' ? youtubeVideoIdFrom(body.youtubeUrl) : null;
      if (!youtubeVideoId) return errorResponse(422, 'invalid-protest', { youtubeUrl: 'invalid' });
      if (!(await attachProtestYoutube(env.CREWS_DB, protestId, youtubeVideoId))) return errorResponse(409, 'youtube-already-added');
      return jsonResponse(200, { protest: await findProtestVisibleTo(env.CREWS_DB, protestId, viewerOf(member)) });
    },

    async listProtests(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'stewards');
      if (authorization instanceof Response) return authorization;
      return jsonResponse(200, { protests: await listProtests(env.CREWS_DB) });
    },

    async getProtest(request: Request, env: Env, protestId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'stewards');
      if (authorization instanceof Response) return authorization;
      const protest = await findProtest(env.CREWS_DB, protestId);
      return protest ? jsonResponse(200, { protest }) : errorResponse(404, 'not-found');
    },

    async getVideo(request: Request, env: Env, protestId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'stewards');
      if (authorization instanceof Response) return authorization;
      return videoResponse(env.PROTEST_VIDEOS, await findProtestVideo(env.CREWS_DB, protestId));
    },

    async reviewProtest(request: Request, env: Env, protestId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'stewards');
      if (authorization instanceof Response) return authorization;
      const review = validateProtestReview(await readJsonBody(request, MAX_PROTEST_BODY_BYTES).catch(() => null));
      if (!review) return errorResponse(422, 'invalid-protest', { review: 'invalid' });
      const protest = await reviewProtest(env.CREWS_DB, protestId, review, authorization.discordUserId);
      return protest ? jsonResponse(200, { protest }) : errorResponse(404, 'not-found');
    },
  };
}
