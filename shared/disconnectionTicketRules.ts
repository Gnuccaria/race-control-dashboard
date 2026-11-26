import { RACE_TIMESTAMP_MAX_MS } from './driverSwapRules';
import { fieldsOf } from './valueRules';

/**
 * Ticket di disconnessione: li manda dal sito chi fa parte del server Discord della lega e li gestisce la
 * Direzione Gara nel calcolatore disconnessioni dell'app. I dati inviati sono definitivi.
 */

export const TICKET_POSITION_MIN = 1;
export const TICKET_POSITION_MAX = 14;
export const TICKET_LAP_MAX = 999;
/** Ticket aperti che la stessa persona può avere in attesa: evita invii a raffica. */
export const MAX_OPEN_TICKETS_PER_USER = 3;

/** Invio dei ticket dal sito aperto o chiuso (interruttore della Direzione Gara nel Calcolatore disconnessioni). */
export interface TicketAvailability {
  readonly isOpen: boolean;
}

/** Corpo della richiesta che apre o chiude l'invio; null se non valido. */
export function readTicketAvailability(input: unknown): TicketAvailability | null {
  const candidate = fieldsOf(input);
  return typeof candidate.isOpen === 'boolean' ? { isOpen: candidate.isOpen } : null;
}

/** In P1 il distacco è dalla P2, dalla P2 in giù è dal leader (P1). */
export const isLeaderPosition = (position: number): boolean => position === TICKET_POSITION_MIN;

/**
 * Dati che manda chi apre il ticket. L'equipaggio non si sceglie: il server lo ricava dal ruolo Discord
 * dell'equipaggio (es. "#16 Vez Team Lime").
 */
export interface DisconnectionTicketReport {
  /** Posizione al momento della disconnessione, 1–14. */
  readonly position: number;
  /** Distacco da P1 (posizione ≥ 2) o da P2 (posizione 1), in millisecondi. */
  readonly gapMs: number;
  readonly disconnectedOnLap: number;
}

/** Ticket completo da salvare: i dati mandati più l'equipaggio ricavato dal ruolo. */
export interface DisconnectionTicketDraft extends DisconnectionTicketReport {
  readonly crewId: number;
}

/** Ticket aperto, come lo vede l'app. Il numero del ticket è l'id. */
export interface DisconnectionTicket extends DisconnectionTicketDraft {
  readonly id: number;
  readonly crewNumber: number;
  readonly crewName: string;
  /** Chi l'ha mandato (nome e handle Discord al momento dell'invio). */
  readonly submittedByName: string;
  readonly submittedByUsername: string;
  readonly createdAt: string;
}

/** Equipaggio di chi manda un ticket o una protesta, con i campionati a cui partecipa (almeno uno). */
export interface TicketCrewOption {
  readonly id: number;
  readonly number: number;
  readonly name: string;
  readonly championships: readonly string[];
}

export interface DisconnectionTicketIssues {
  readonly position?: 'required' | 'out-of-range';
  readonly gapMs?: 'required' | 'invalid';
  readonly disconnectedOnLap?: 'required' | 'out-of-range';
}

export type DisconnectionTicketValidation =
  | { readonly isValid: true; readonly ticket: DisconnectionTicketReport }
  | { readonly isValid: false; readonly issues: DisconnectionTicketIssues };

const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);

/** Stessa convalida nel sito (prima dell'invio) e nel server. */
export function validateDisconnectionTicketDraft(rawValue: unknown): DisconnectionTicketValidation {
  const candidate = (rawValue ?? {}) as Record<string, unknown>;
  const issues: { -readonly [Key in keyof DisconnectionTicketIssues]: DisconnectionTicketIssues[Key] } = {};
  const { position, gapMs, disconnectedOnLap } = candidate;

  if (position === undefined || position === null) issues.position = 'required';
  else if (!isInteger(position) || position < TICKET_POSITION_MIN || position > TICKET_POSITION_MAX) issues.position = 'out-of-range';
  if (gapMs === undefined || gapMs === null) issues.gapMs = 'required';
  else if (!isInteger(gapMs) || gapMs < 0 || gapMs > RACE_TIMESTAMP_MAX_MS) issues.gapMs = 'invalid';
  if (disconnectedOnLap === undefined || disconnectedOnLap === null) issues.disconnectedOnLap = 'required';
  else if (!isInteger(disconnectedOnLap) || disconnectedOnLap < 0 || disconnectedOnLap > TICKET_LAP_MAX) issues.disconnectedOnLap = 'out-of-range';

  if (Object.keys(issues).length > 0) return { isValid: false, issues };
  return {
    isValid: true,
    ticket: { position: position as number, gapMs: gapMs as number, disconnectedOnLap: disconnectedOnLap as number },
  };
}

/* ---------- Equipaggio dal ruolo Discord ---------- */

/** "#16 Vez Team Lime" → 16; i ruoli che non iniziano con "#numero" non sono ruoli di equipaggio. */
export function crewNumberFromRoleName(roleName: string): number | null {
  const match = /^#\s?(\d{1,3})(?:\s|$)/.exec(roleName.trim());
  return match ? Number(match[1]) : null;
}

/** Perché non si trova l'equipaggio di chi apre il ticket. */
export type TicketCrewProblem = 'no-crew-role' | 'multiple-crew-roles' | 'crew-not-found' | 'bot-unavailable';

/* ---------- Risultato del calcolatore ---------- */

/** Passaggi del calcolo del tempo di attesa, come nel "Dettaglio del calcolo" dell'app. */
export interface TicketResultDetails {
  /** leader = era in P1 (distacco dalla P2 e ingresso in pit stall), chasing = P2–P14 (distacco dal leader). */
  readonly position: 'leader' | 'chasing';
  readonly missingLaps: number;
  readonly penaltySeconds: number;
  readonly gapSeconds: number;
  readonly pitStallEntrySeconds: number;
  readonly totalWaitSeconds: number;
  readonly trackLengthKm: number;
  readonly driveThroughSeconds: number;
  readonly stintTotalLaps: number;
}

const RESULT_NUMBER_FIELDS = [
  'missingLaps',
  'penaltySeconds',
  'gapSeconds',
  'pitStallEntrySeconds',
  'totalWaitSeconds',
  'trackLengthKm',
  'driveThroughSeconds',
  'stintTotalLaps',
] as const;
/** Limite largo per i numeri del calcolo (secondi, giri, km): basta a scartare valori assurdi. */
const RESULT_NUMBER_LIMIT = 1_000_000;

/** Dettaglio mandato dall'app → valori convalidati, oppure null. */
export function readTicketResultDetails(rawValue: unknown): TicketResultDetails | null {
  if (typeof rawValue !== 'object' || rawValue === null) return null;
  const candidate = rawValue as Record<string, unknown>;
  if (candidate.position !== 'leader' && candidate.position !== 'chasing') return null;
  const numbers: Partial<Record<(typeof RESULT_NUMBER_FIELDS)[number], number>> = {};
  for (const field of RESULT_NUMBER_FIELDS) {
    const value = candidate[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > RESULT_NUMBER_LIMIT) return null;
    numbers[field] = value;
  }
  return { position: candidate.position, ...(numbers as Record<(typeof RESULT_NUMBER_FIELDS)[number], number>) };
}

/** Tempo di attesa in millisecondi, come si salva e come lo mostra il sito. */
export const waitingTimeMsOf = (details: TicketResultDetails): number => Math.round(details.totalWaitSeconds * 1000);

/** Ticket come lo vede sul sito chi l'ha mandato: dati, stato e, quando c'è, il risultato. */
export interface SiteDisconnectionTicket extends DisconnectionTicket {
  readonly status: 'open' | 'resolved';
  readonly resolvedAt: string | null;
  readonly result: TicketResultDetails | null;
}

/* ---------- Distacco scritto dal pilota ---------- */

/** Distacco massimo accettato: meno di 100 ore. */
export const TICKET_GAP_MAX_MS = 100 * 3_600_000 - 1;

/**
 * Legge il distacco scritto dal pilota e lo porta in millisecondi. Forme accettate:
 *   "83" (numero intero = secondi) · "83,5" o "83.5" (secondi con decimali) · "1:23.456" (minuti:secondi) ·
 *   "00:01:23.456" o "00:01:23,456" (HH:MM:SS.DDD) · "00.01.23.456" o "00.01.23,456" (HH.MM.SS.DDD, con soli punti) ·
 *   "000123,456", "000123.456" o "000123" (sei cifre attaccate: HHMMSS, con o senza millesimi).
 * I decimali vanno sempre dopo un punto o una virgola (al massimo tre cifre): con soli punti, l'ultimo punto
 * separa i decimali. Minuti e secondi dopo il primo gruppo hanno sempre due cifre (00–59).
 * Vuoto → null; non interpretabile → NaN.
 */
export function parseTicketGap(gapText: string): number | null {
  const text = gapText.trim();
  if (text === '') return null;
  if (!/^[\d:.,]+$/.test(text)) return Number.NaN;

  let clock = text;
  let fraction: string | null = null;
  const commaIndex = text.indexOf(',');
  if (commaIndex >= 0) {
    if (commaIndex !== text.lastIndexOf(',')) return Number.NaN;
    clock = text.slice(0, commaIndex);
    fraction = text.slice(commaIndex + 1);
  } else {
    const dotIndex = text.lastIndexOf('.');
    // Con i ":" il punto separa i decimali solo dopo l'ultimo ":"; con soli punti lo fa sempre l'ultimo punto.
    if (dotIndex >= 0 && dotIndex > text.lastIndexOf(':')) {
      clock = text.slice(0, dotIndex);
      fraction = text.slice(dotIndex + 1);
    }
  }
  if (fraction !== null && !/^\d{1,3}$/.test(fraction)) return Number.NaN;

  const groups = clock.split(clock.includes(':') ? ':' : '.');
  if (groups.length > 3 || (clock.includes(':') && clock.includes('.'))) return Number.NaN;
  if (groups.length === 1 && !/^\d{1,6}$/.test(groups[0] ?? '')) return Number.NaN;
  // Sei cifre attaccate sono HHMMSS (minuti e secondi 00–59), non secondi.
  if (groups.length === 1 && (groups[0] ?? '').length === 6) {
    const digits = groups[0] ?? '';
    groups.splice(0, 1, digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6));
  }
  if (groups.length > 1 && groups.some((group, index) => !(index === 0 ? /^\d{1,2}$/ : /^[0-5]\d$/).test(group))) return Number.NaN;

  const totalSeconds = groups.reduce((seconds, group) => seconds * 60 + Number(group), 0);
  const milliseconds = totalSeconds * 1000 + Number((fraction ?? '').padEnd(3, '0'));
  return milliseconds <= TICKET_GAP_MAX_MS ? milliseconds : Number.NaN;
}

const padGap = (value: number, length = 2) => String(value).padStart(length, '0');

/** Millisecondi → "HH:MM:SS.DDD". */
export function formatTicketGap(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${padGap(Math.floor(totalSeconds / 3600))}:${padGap(Math.floor((totalSeconds % 3600) / 60))}:${padGap(totalSeconds % 60)}.${padGap(milliseconds % 1000, 3)}`;
}

/** Testo scritto → "HH:MM:SS.DDD" se interpretabile, altrimenti invariato (e quindi segnalato come errore). */
export function normalizeTicketGapText(gapText: string): string {
  const milliseconds = parseTicketGap(gapText);
  return milliseconds === null || Number.isNaN(milliseconds) ? gapText : formatTicketGap(milliseconds);
}

/**
 * Esito del messaggio del bot con il risultato, nel canale Discord dell'equipaggio:
 * scritto, equipaggio senza canale, oppure non riuscito (bot non configurato, senza permessi, Discord non raggiungibile).
 */
export type TicketDiscordMessage = 'sent' | 'no-channel' | 'failed';
export const isTicketDiscordMessage = (value: unknown): value is TicketDiscordMessage =>
  value === 'sent' || value === 'no-channel' || value === 'failed';

/** Pagina del sito con il modulo dei ticket e, sotto, la pagina di ogni ticket (usata anche nel messaggio del bot). */
export const SITE_DISCONNECTION_TICKET_PATH = '/ticket-disconnessione';
export const siteDisconnectionTicketPath = (ticketId: number) => `${SITE_DISCONNECTION_TICKET_PATH}/${ticketId}`;
