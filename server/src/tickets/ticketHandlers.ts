import {
  MAX_OPEN_TICKETS_PER_USER,
  readTicketAvailability as readTicketAvailabilityBody,
  readTicketResultDetails,
  type TicketCrewProblem,
  validateDisconnectionTicketDraft,
} from '../../../shared/disconnectionTicketRules';
import { authorizeRequest, checkMembershipWithDiscord, type MembershipChecker } from '../auth/authorizeRequest';
import type { Env } from '../env';
import { errorResponse, jsonResponse } from '../http/jsonResponse';
import { readJsonBody } from '../http/readJsonBody';
import { authorizeSiteMember, type DiscordFetch } from '../siteAuth/siteDiscordAuth';
import { readTicketAvailability, saveTicketAvailability } from './ticketAvailability';
import { findTicketCrewFromRoles } from './ticketCrewFromRoles';
import { postTicketResultToDiscord } from './ticketResultNotice';
import {
  countOpenTicketsBy,
  findTicketNoticeTarget,
  findTicketVisibleTo,
  insertTicket,
  listOpenTickets,
  listTicketsVisibleTo,
  resolveTicket,
} from './ticketRepository';

/** Equipaggio non trovato: 503 se il bot non risponde, altrimenti 422 con il motivo. */
const crewProblemResponse = (problem: TicketCrewProblem) =>
  problem === 'bot-unavailable' ? errorResponse(503, 'bot-unavailable') : errorResponse(422, problem);

/**
 * Ticket di disconnessione.
 *   GET  /public/disconnection-tickets/crew   equipaggio di chi è entrato, dal suo ruolo Discord (sito)
 *   POST /public/disconnection-tickets        invio dal sito; l'equipaggio lo ricava il server dal ruolo
 *   GET  /public/disconnection-tickets/mine   ticket di chi è entrato e del suo equipaggio (stesso ruolo), con i risultati (sito)
 *   GET  /public/disconnection-tickets/:id    uno di quei ticket (sito)
 *   GET  /public/disconnection-tickets/availability   { isOpen }: il sito accetta i ticket? (pubblico, anche senza accesso)
 *   GET  /disconnection-tickets/availability  { isOpen } (app, ruolo Direttore Gara)
 *   PUT  /disconnection-tickets/availability  { isOpen }: apre o chiude l'invio dal sito (app, ruolo Direttore Gara)
 *   GET  /disconnection-tickets               ticket da gestire (app, ruolo Direttore Gara)
 *   POST /disconnection-tickets/:id/result    { details }: chiude il ticket con il dettaglio del calcolo (app) e il bot
 *                                             scrive il risultato nel canale Discord dell'equipaggio → { discordMessage }
 * Sul sito basta far parte del server Discord della lega e avere il ruolo del proprio equipaggio; con l'invio chiuso
 * POST /public/disconnection-tickets risponde 409 tickets-closed (i ticket già mandati restano visibili).
 */
export function createTicketHandlers(checkMembership: MembershipChecker = checkMembershipWithDiscord, discordFetch: DiscordFetch = fetch) {
  return {
    async getPublicAvailability(_request: Request, env: Env): Promise<Response> {
      return jsonResponse(200, await readTicketAvailability(env.CREWS_DB));
    },

    async getAvailability(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'raceControl');
      if (authorization instanceof Response) return authorization;
      return jsonResponse(200, await readTicketAvailability(env.CREWS_DB));
    },

    async saveAvailability(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'raceControl');
      if (authorization instanceof Response) return authorization;
      const availability = readTicketAvailabilityBody(await readJsonBody(request).catch(() => null));
      if (!availability) return errorResponse(422, 'invalid-request');
      return jsonResponse(200, await saveTicketAvailability(env.CREWS_DB, availability, authorization.discordUserId));
    },

    async getMyCrew(request: Request, env: Env): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;
      const lookup = await findTicketCrewFromRoles(discordFetch, env, env.CREWS_DB, member.roleIds);
      return 'crew' in lookup ? jsonResponse(200, { crew: lookup.crew }) : crewProblemResponse(lookup.problem);
    },

    async submitTicket(request: Request, env: Env): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;

      if (!(await readTicketAvailability(env.CREWS_DB)).isOpen) return errorResponse(409, 'tickets-closed');
      const validation = validateDisconnectionTicketDraft(await readJsonBody(request));
      if (!validation.isValid) return errorResponse(422, 'invalid-ticket', validation.issues);
      const lookup = await findTicketCrewFromRoles(discordFetch, env, env.CREWS_DB, member.roleIds);
      if (!('crew' in lookup)) return crewProblemResponse(lookup.problem);
      const { profile } = member;
      if ((await countOpenTicketsBy(env.CREWS_DB, profile.id)) >= MAX_OPEN_TICKETS_PER_USER) return errorResponse(429, 'too-many-tickets');

      const ticket = await insertTicket(env.CREWS_DB, { ...validation.ticket, crewId: lookup.crew.id }, lookup.crew, {
        discordUserId: profile.id,
        displayName: profile.displayName,
        username: profile.username,
        crewRoleId: lookup.roleId,
      });
      return jsonResponse(201, { ticket: { id: ticket.id } });
    },

    async listMyTickets(request: Request, env: Env): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;
      return jsonResponse(200, { tickets: await listTicketsVisibleTo(env.CREWS_DB, { discordUserId: member.profile.id, roleIds: member.roleIds }) });
    },

    async getMyTicket(request: Request, env: Env, ticketId: number): Promise<Response> {
      const member = await authorizeSiteMember(discordFetch, env, request);
      if (member instanceof Response) return member;
      const ticket = await findTicketVisibleTo(env.CREWS_DB, ticketId, { discordUserId: member.profile.id, roleIds: member.roleIds });
      return ticket ? jsonResponse(200, { ticket }) : errorResponse(404, 'not-found');
    },

    async listOpenTickets(request: Request, env: Env): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'raceControl');
      if (authorization instanceof Response) return authorization;
      return jsonResponse(200, { tickets: await listOpenTickets(env.CREWS_DB) });
    },

    async submitResult(request: Request, env: Env, ticketId: number): Promise<Response> {
      const authorization = await authorizeRequest(request, env, checkMembership, 'raceControl');
      if (authorization instanceof Response) return authorization;
      const body = (await readJsonBody(request)) as { details?: unknown } | undefined;
      const details = readTicketResultDetails(body?.details);
      if (!details) return errorResponse(422, 'invalid-ticket', { details: 'invalid' });

      const outcome = await resolveTicket(env.CREWS_DB, ticketId, details, authorization.discordUserId);
      if (outcome === 'not-found') return errorResponse(404, 'not-found');
      if (outcome === 'already-resolved') return errorResponse(409, 'ticket-already-resolved');
      // Il risultato è salvato comunque: se il bot non riesce a scrivere, l'app lo segnala e basta.
      const target = await findTicketNoticeTarget(env.CREWS_DB, ticketId);
      const discordMessage = target ? await postTicketResultToDiscord(discordFetch, env, target, details, new URL(request.url).origin) : 'failed';
      return jsonResponse(200, { discordMessage });
    },
  };
}
