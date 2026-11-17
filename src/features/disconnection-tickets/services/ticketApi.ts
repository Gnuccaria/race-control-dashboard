import {
  type DisconnectionTicket,
  isTicketDiscordMessage,
  type TicketAvailability,
  type TicketDiscordMessage,
  type TicketResultDetails,
} from '@shared/disconnectionTicketRules';
import { requestServerApi } from '@/services/serverApi';

/** Il sito accetta i ticket di disconnessione? */
export const fetchTicketAvailability = () =>
  requestServerApi({ method: 'GET', path: '/disconnection-tickets/availability' }, (responseBody) => responseBody as TicketAvailability);

/** Apre o chiude l'invio dei ticket dal sito; restituisce lo stato salvato. */
export const saveTicketAvailability = (availability: TicketAvailability) =>
  requestServerApi({ method: 'PUT', path: '/disconnection-tickets/availability', body: availability }, (responseBody) => responseBody as TicketAvailability);

/** Ticket di disconnessione ancora da gestire, dal più vecchio. */
export const fetchOpenTickets = () =>
  requestServerApi({ method: 'GET', path: '/disconnection-tickets' }, (responseBody) => (responseBody as { tickets: DisconnectionTicket[] }).tickets);

/**
 * Chiude il ticket con il dettaglio del calcolo (il sito lo mostra a chi l'ha mandato) e restituisce l'esito del
 * messaggio del bot nel canale Discord dell'equipaggio; null se il server non lo dice (versione precedente).
 */
export const submitTicketResult = (ticketId: number, details: TicketResultDetails) =>
  requestServerApi(
    { method: 'POST', path: `/disconnection-tickets/${ticketId}/result`, body: { details } },
    (responseBody): TicketDiscordMessage | null => {
      const discordMessage = (responseBody as { discordMessage?: unknown } | undefined)?.discordMessage;
      return isTicketDiscordMessage(discordMessage) ? discordMessage : null;
    },
  );
