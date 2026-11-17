import type {
  DisconnectionTicketIssues,
  DisconnectionTicketReport,
  SiteDisconnectionTicket,
  TicketAvailability,
  TicketCrewOption,
  TicketCrewProblem,
} from '@shared/disconnectionTicketRules';
import { API_BASE_URL } from './publicRaces';

/** Motivi per cui una richiesta sui ticket non va: accesso scaduto, non membro, equipaggio, dati, limite, rete. */
export type TicketRequestProblem =
  | 'signed-out'
  | 'not-guild-member'
  | TicketCrewProblem
  | 'invalid'
  | 'too-many-tickets'
  | 'closed'
  | 'not-found'
  | 'unavailable';

export type TicketRequestResult<Value> =
  | { readonly isSuccess: true; readonly value: Value }
  | { readonly isSuccess: false; readonly problem: TicketRequestProblem; readonly issues?: DisconnectionTicketIssues };

const CREW_PROBLEMS: readonly string[] = ['no-crew-role', 'multiple-crew-roles', 'crew-not-found', 'bot-unavailable'];

type ErrorBody = { error?: { code?: string; details?: DisconnectionTicketIssues } } | null;

/** Attesa prima di riprovare quando il server non è riuscito a verificare l'accesso con Discord (errore passeggero). */
const DISCORD_RETRY_DELAY_MS = 2000;

async function requestTickets<Value>(accessToken: string, path: string, init: RequestInit, read: (body: unknown) => Value): Promise<TicketRequestResult<Value>> {
  const send = async () => {
    const response = await fetch(`${API_BASE_URL}/public/disconnection-tickets${path}`, {
      ...init,
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}`, ...init.headers },
    });
    return { response, body: (await response.json().catch(() => null)) as ErrorBody };
  };
  let response: Response;
  let body: ErrorBody;
  try {
    ({ response, body } = await send());
    // Discord non ha risposto alla verifica dell'accesso: la richiesta non è stata eseguita, si può riprovare (anche l'invio).
    if (response.status === 503 && body?.error?.code === 'discord-unavailable') {
      await new Promise((resolve) => setTimeout(resolve, DISCORD_RETRY_DELAY_MS));
      ({ response, body } = await send());
    }
  } catch {
    return { isSuccess: false, problem: 'unavailable' };
  }
  if (response.ok && body) return { isSuccess: true, value: read(body) };
  const code = body?.error?.code ?? '';
  if (CREW_PROBLEMS.includes(code)) return { isSuccess: false, problem: code as TicketCrewProblem };
  if (code === 'tickets-closed') return { isSuccess: false, problem: 'closed' };
  if (response.status === 401) return { isSuccess: false, problem: 'signed-out' };
  if (response.status === 403) return { isSuccess: false, problem: 'not-guild-member' };
  if (response.status === 404) return { isSuccess: false, problem: 'not-found' };
  if (response.status === 429) return { isSuccess: false, problem: 'too-many-tickets' };
  if (response.status === 422) return { isSuccess: false, problem: 'invalid', ...(body?.error?.details && { issues: body.error.details }) };
  return { isSuccess: false, problem: 'unavailable' };
}

/** Il sito accetta i ticket? Pubblico, senza accesso; se il server non risponde si considera aperto (decide il server all'invio). */
export async function fetchTicketAvailability(): Promise<TicketAvailability> {
  try {
    const response = await fetch(`${API_BASE_URL}/public/disconnection-tickets/availability`, { headers: { Accept: 'application/json' } });
    const body = (await response.json().catch(() => null)) as { isOpen?: unknown } | null;
    return { isOpen: !(response.ok && body?.isOpen === false) };
  } catch {
    return { isOpen: true };
  }
}

/** Equipaggio di chi è entrato, ricavato dal server dal ruolo Discord dell'equipaggio. */
export const fetchMyTicketCrew = (accessToken: string) =>
  requestTickets(accessToken, '/crew', {}, (body) => (body as { crew: TicketCrewOption }).crew);

/** Invia il ticket (l'equipaggio lo aggiunge il server dal ruolo). */
export const submitDisconnectionTicket = (accessToken: string, report: DisconnectionTicketReport) =>
  requestTickets(
    accessToken,
    '',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) },
    (body) => (body as { ticket: { id: number } }).ticket.id,
  );

/** Ticket mandati da chi è entrato, con stato e risultato. */
export const fetchMyTickets = (accessToken: string) =>
  requestTickets(accessToken, '/mine', {}, (body) => (body as { tickets: SiteDisconnectionTicket[] }).tickets);

export const fetchMyTicket = (accessToken: string, ticketId: number) =>
  requestTickets(accessToken, `/${ticketId}`, {}, (body) => (body as { ticket: SiteDisconnectionTicket }).ticket);
