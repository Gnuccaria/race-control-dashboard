import type { MembershipChecker } from './auth/authorizeRequest';
import { createCarHandlers } from './cars/carHandlers';
import type { SourceFetch } from './cars/carSources';
import { createChampionshipHandlers } from './championships/championshipHandlers';
import { createCrewHandlers } from './crews/crewHandlers';
import type { Env } from './env';
import { errorResponse, jsonResponse } from './http/jsonResponse';
import { createPenaltyHandlers } from './penalties/penaltyHandlers';
import { publicRaceHandlers } from './public/publicRaceHandlers';
import { createRaceHandlers } from './races/raceHandlers';
import { createProtestHandlers } from './protests/protestHandlers';
import { createSiteAuthHandlers, type DiscordFetch } from './siteAuth/siteDiscordAuth';
import { createTicketHandlers } from './tickets/ticketHandlers';
import { createTrackHandlers } from './tracks/trackHandlers';

type CollectionHandler = (request: Request, env: Env) => Promise<Response>;
type ItemHandler = (request: Request, env: Env, itemId: number) => Promise<Response>;
type NestedItemHandler = (request: Request, env: Env, parentId: number, itemId: number) => Promise<Response>;

interface ResourceRoutes {
  readonly collection: Partial<Record<string, CollectionHandler>>;
  readonly item?: Partial<Record<string, ItemHandler>>;
}

/** /crews/42 → ["crews", 42]; /races → ["races", null]. */
const RESOURCE_PATH_PATTERN = /^\/([a-z]+)(?:\/(\d{1,9}))?$/;
/** Penalità di una gara: /races/42/penalties e /races/42/penalties/7. */
const RACE_PENALTIES_PATTERN = /^\/races\/(\d{1,9})\/penalties(?:\/(\d{1,9}))?$/;
/** Reprimende già date prima di una penalità: /races/42/reprimands?before=7. */
const RACE_REPRIMANDS_PATTERN = /^\/races\/(\d{1,9})\/reprimands$/;
/** Solo i cambi pilota di una gara (Commissari Sportivi): /races/42/driver-swaps. */
const RACE_DRIVER_SWAPS_PATTERN = /^\/races\/(\d{1,9})\/driver-swaps$/;
/** Lettura pubblica per il sito: /public/races, /public/races/42 e il referto /public/races/42/report.pdf. */
/** Risultato di un ticket di disconnessione: /disconnection-tickets/7/result. */
const TICKET_RESULT_PATTERN = /^\/disconnection-tickets\/(\d{1,9})\/result$/;
/** Un ticket di chi è entrato nel sito: /public/disconnection-tickets/7. */
const SITE_TICKET_PATTERN = /^\/public\/disconnection-tickets\/(\d{1,9})$/;
/** Video di una protesta: /public/protests/7/video (caricamento dal sito) e /protests/7/video (app). */
const SITE_PROTEST_PATTERN = /^\/public\/protests\/(\d{1,9})(?:\/(video|youtube))?$/;
const PROTEST_PATTERN = /^\/protests\/(\d{1,9})(?:\/(video|review))?$/;
const PUBLIC_RACES_PATTERN = /^\/public\/races(?:\/(\d{1,9})(\/report\.pdf)?)?$/;

const methodNotAllowed = () => errorResponse(405, 'method-not-allowed');

/**
 * Instradamento delle richieste:
 *   GET /health
 *   GET · POST · DELETE /crews       GET · PUT /crews/:id
 *   GET · POST · DELETE /races       GET · PUT /races/:id
 *   GET · POST · DELETE /races/:id/penalties    GET · PUT /races/:id/penalties/:penaltyId
 *   GET /races/:id/reprimands[?before=:penaltyId]
 *   PUT /races/:id/driver-swaps   (solo i cambi pilota, Commissari Sportivi)
 *   GET · POST · DELETE /championships   GET · PUT /championships/:id
 *   GET · POST /tracks
 *   GET /cars   POST /cars/refresh   (vetture; aggiornamento dai siti, Organizzazione)
 *   GET /public/races                GET /public/races/:id   (sito dei risultati, senza accesso)
 *   GET /public/races/:id/report.pdf (referto di gara in PDF)
 *   POST /public/discord/session · /refresh · /sign-out   GET /public/discord/me   (accesso al sito con Discord)
 *   GET /public/disconnection-tickets/crew · /mine · /:id   POST /public/disconnection-tickets   (ticket dal sito)
 *   GET /disconnection-tickets   POST /disconnection-tickets/:id/result   GET|PUT /disconnection-tickets/availability   (app, Direzione Gara)
 *   GET /public/disconnection-tickets/availability   (sito: invio dei ticket aperto o chiuso)
 *   GET /public/protests/form · /mine · /:id · /:id/video   POST /public/protests   PUT /public/protests/:id/video · /:id/youtube   (proteste dal sito)
 *   GET /protests · /protests/:id · /protests/:id/video   PUT /protests/:id/review   (proteste nell'app, Commissari Sportivi)
 * La verifica Discord, le chiamate a Discord dell'accesso al sito e lo scaricamento dei siti delle vetture sono iniettabili per i test.
 */
export function createApp(checkMembership?: MembershipChecker, discordFetch?: DiscordFetch, carSourceFetch?: SourceFetch) {
  const crewHandlers = createCrewHandlers(checkMembership);
  const raceHandlers = createRaceHandlers(checkMembership);
  const trackHandlers = createTrackHandlers(checkMembership);
  const carHandlers = createCarHandlers(checkMembership, carSourceFetch);
  const championshipHandlers = createChampionshipHandlers(checkMembership);
  const penaltyHandlers = createPenaltyHandlers(checkMembership);
  const siteAuthHandlers = createSiteAuthHandlers(discordFetch);
  const ticketHandlers = createTicketHandlers(checkMembership, discordFetch);
  const protestHandlers = createProtestHandlers(checkMembership, discordFetch);
  const siteAuthRoutes: Record<string, { readonly method: string; readonly handler: CollectionHandler }> = {
    '/public/discord/session': { method: 'POST', handler: siteAuthHandlers.startSession },
    '/public/discord/refresh': { method: 'POST', handler: siteAuthHandlers.refreshSession },
    '/public/discord/me': { method: 'GET', handler: siteAuthHandlers.getProfile },
    '/public/discord/sign-out': { method: 'POST', handler: siteAuthHandlers.signOut },
    '/public/disconnection-tickets/crew': { method: 'GET', handler: ticketHandlers.getMyCrew },
    '/public/disconnection-tickets/mine': { method: 'GET', handler: ticketHandlers.listMyTickets },
    '/public/disconnection-tickets/availability': { method: 'GET', handler: ticketHandlers.getPublicAvailability },
    '/public/disconnection-tickets': { method: 'POST', handler: ticketHandlers.submitTicket },
    '/disconnection-tickets': { method: 'GET', handler: ticketHandlers.listOpenTickets },
    '/public/protests/form': { method: 'GET', handler: protestHandlers.getForm },
    '/public/protests/mine': { method: 'GET', handler: protestHandlers.listMyProtests },
    '/public/protests': { method: 'POST', handler: protestHandlers.submitProtest },
    '/protests': { method: 'GET', handler: protestHandlers.listProtests },
    '/cars/refresh': { method: 'POST', handler: carHandlers.refreshCars },
  };

  const resources: Record<string, ResourceRoutes> = {
    crews: {
      collection: { GET: crewHandlers.listCrews, POST: crewHandlers.createCrew, DELETE: crewHandlers.deleteCrews },
      item: { GET: crewHandlers.getCrew, PUT: crewHandlers.updateCrew },
    },
    races: {
      collection: { GET: raceHandlers.listRaces, POST: raceHandlers.createRace, DELETE: raceHandlers.deleteRaces },
      item: { GET: raceHandlers.getRace, PUT: raceHandlers.updateRace },
    },
    championships: {
      collection: { GET: championshipHandlers.listChampionships, POST: championshipHandlers.createChampionship, DELETE: championshipHandlers.deleteChampionships },
      item: { GET: championshipHandlers.getChampionship, PUT: championshipHandlers.updateChampionship },
    },
    tracks: {
      collection: { GET: trackHandlers.listTracks, POST: trackHandlers.createTrack },
    },
    cars: {
      collection: { GET: carHandlers.listCars },
    },
  };

  async function route(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/health') return request.method === 'GET' ? jsonResponse(200, { status: 'ok' }) : methodNotAllowed();

    if (pathname === '/disconnection-tickets/availability') {
      if (request.method === 'GET') return ticketHandlers.getAvailability(request, env);
      if (request.method === 'PUT') return ticketHandlers.saveAvailability(request, env);
      return methodNotAllowed();
    }

    const siteAuthRoute = siteAuthRoutes[pathname];
    if (siteAuthRoute) return request.method === siteAuthRoute.method ? siteAuthRoute.handler(request, env) : methodNotAllowed();

    const siteTicketMatch = SITE_TICKET_PATTERN.exec(pathname);
    if (siteTicketMatch) {
      return request.method === 'GET' ? ticketHandlers.getMyTicket(request, env, Number(siteTicketMatch[1])) : methodNotAllowed();
    }

    const siteProtestMatch = SITE_PROTEST_PATTERN.exec(pathname);
    if (siteProtestMatch) {
      const protestId = Number(siteProtestMatch[1]);
      const part = siteProtestMatch[2];
      if (part === 'video' && request.method === 'PUT') return protestHandlers.uploadVideo(request, env, protestId);
      if (part === 'video' && request.method === 'GET') return protestHandlers.getMyProtestVideo(request, env, protestId);
      if (part === 'youtube' && request.method === 'PUT') return protestHandlers.addYoutube(request, env, protestId);
      if (part === undefined && request.method === 'GET') return protestHandlers.getMyProtest(request, env, protestId);
      return methodNotAllowed();
    }

    const protestMatch = PROTEST_PATTERN.exec(pathname);
    if (protestMatch) {
      const protestId = Number(protestMatch[1]);
      const part = protestMatch[2];
      if (part === 'review') return request.method === 'PUT' ? protestHandlers.reviewProtest(request, env, protestId) : methodNotAllowed();
      if (request.method !== 'GET') return methodNotAllowed();
      return part === 'video' ? protestHandlers.getVideo(request, env, protestId) : protestHandlers.getProtest(request, env, protestId);
    }

    const ticketResultMatch = TICKET_RESULT_PATTERN.exec(pathname);
    if (ticketResultMatch) {
      return request.method === 'POST' ? ticketHandlers.submitResult(request, env, Number(ticketResultMatch[1])) : methodNotAllowed();
    }

    const publicMatch = PUBLIC_RACES_PATTERN.exec(pathname);
    if (publicMatch) {
      if (request.method !== 'GET') return methodNotAllowed();
      const raceIdText = publicMatch[1];
      if (raceIdText === undefined) return publicRaceHandlers.listRaces(request, env);
      if (publicMatch[2]) return publicRaceHandlers.getRaceReport(request, env, Number(raceIdText));
      return publicRaceHandlers.getRace(request, env, Number(raceIdText));
    }

    const driverSwapsMatch = RACE_DRIVER_SWAPS_PATTERN.exec(pathname);
    if (driverSwapsMatch) {
      return request.method === 'PUT' ? raceHandlers.updateDriverSwaps(request, env, Number(driverSwapsMatch[1])) : methodNotAllowed();
    }

    const reprimandsMatch = RACE_REPRIMANDS_PATTERN.exec(pathname);
    if (reprimandsMatch) {
      return request.method === 'GET' ? penaltyHandlers.countReprimands(request, env, Number(reprimandsMatch[1])) : methodNotAllowed();
    }

    const penaltiesMatch = RACE_PENALTIES_PATTERN.exec(pathname);
    if (penaltiesMatch) {
      const raceId = Number(penaltiesMatch[1]);
      const penaltyIdText = penaltiesMatch[2];
      if (penaltyIdText === undefined) {
        const collectionHandlers: Partial<Record<string, ItemHandler>> = {
          GET: penaltyHandlers.listPenalties,
          POST: penaltyHandlers.createPenalty,
          DELETE: penaltyHandlers.deletePenalties,
        };
        const collectionHandler = collectionHandlers[request.method];
        return collectionHandler ? collectionHandler(request, env, raceId) : methodNotAllowed();
      }
      const itemHandlers: Partial<Record<string, NestedItemHandler>> = { GET: penaltyHandlers.getPenalty, PUT: penaltyHandlers.updatePenalty };
      const itemHandler = itemHandlers[request.method];
      return itemHandler ? itemHandler(request, env, raceId, Number(penaltyIdText)) : methodNotAllowed();
    }

    const pathMatch = RESOURCE_PATH_PATTERN.exec(pathname);
    const resource = pathMatch?.[1] ? resources[pathMatch[1]] : undefined;
    if (!pathMatch || !resource) return errorResponse(404, 'not-found');

    const itemIdText = pathMatch[2];
    if (itemIdText === undefined) {
      const collectionHandler = resource.collection[request.method];
      return collectionHandler ? collectionHandler(request, env) : methodNotAllowed();
    }
    if (!resource.item) return errorResponse(404, 'not-found');
    const itemHandler = resource.item[request.method];
    return itemHandler ? itemHandler(request, env, Number(itemIdText)) : methodNotAllowed();
  }

  return async function handleRequest(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (unexpectedError) {
      console.error('Errore imprevisto', unexpectedError);
      return errorResponse(500, 'unexpected');
    }
  };
}
