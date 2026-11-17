import {
  type DisconnectionTicket,
  type DisconnectionTicketDraft,
  readTicketResultDetails,
  type SiteDisconnectionTicket,
  type TicketCrewOption,
  type TicketResultDetails,
  waitingTimeMsOf,
} from '../../../shared/disconnectionTicketRules';
import type { SqlDatabase } from '../database/sqlDatabase';

const TICKET_COLUMNS = `
  id, crew_id AS crewId, crew_number AS crewNumber, crew_name AS crewName, position, gap_ms AS gapMs,
  disconnected_on_lap AS disconnectedOnLap, submitted_by_name AS submittedByName,
  submitted_by_username AS submittedByUsername, created_at AS createdAt`;

/**
 * Equipaggio dal numero letto nel nome del ruolo ("#16 ..."), solo tra quelli senza un ruolo Discord collegato:
 * un equipaggio con il ruolo collegato si riconosce solo da quel ruolo.
 */
export async function findTicketCrewByNumber(database: SqlDatabase, crewNumber: number): Promise<TicketCrewOption | null> {
  const row = await database
    .prepare(`${TICKET_CREW_SELECT} WHERE crews.number = ? AND crews.discord_role_id IS NULL`)
    .bind(crewNumber)
    .first<TicketCrewRow>();
  return row ? toTicketCrew(row) : null;
}

/** Equipaggi che partecipano ad almeno un campionato, con i campionati separati da "|". */
const TICKET_CREW_SELECT = `
  SELECT crews.id, crews.number, crews.name, crews.discord_role_id AS roleId,
    (SELECT group_concat(championship, '|') FROM crew_championships WHERE crew_id = crews.id) AS championshipsText
  FROM crews`;

interface TicketCrewRow {
  readonly id: number;
  readonly number: number;
  readonly name: string;
  readonly roleId: string | null;
  readonly championshipsText: string | null;
}

/** null se l'equipaggio non partecipa a nessun campionato (non può mandare ticket né proteste). */
const toTicketCrew = (row: TicketCrewRow): TicketCrewOption | null =>
  row.championshipsText ? { id: row.id, number: row.number, name: row.name, championships: row.championshipsText.split('|') } : null;

/** Equipaggi in campionato il cui ruolo Discord collegato è tra quelli indicati, con il ruolo. */
export async function findTicketCrewsByRoleIds(
  database: SqlDatabase,
  roleIds: readonly string[],
): Promise<(TicketCrewOption & { readonly roleId: string })[]> {
  if (roleIds.length === 0) return [];
  const { results } = await database
    .prepare(`${TICKET_CREW_SELECT} WHERE crews.discord_role_id IN (SELECT value FROM json_each(?)) ORDER BY crews.number`)
    .bind(JSON.stringify(roleIds))
    .all<TicketCrewRow>();
  return results.flatMap((row) => {
    const crew = toTicketCrew(row);
    return crew && row.roleId ? [{ ...crew, roleId: row.roleId }] : [];
  });
}

export async function countOpenTicketsBy(database: SqlDatabase, discordUserId: string): Promise<number> {
  const row = await database
    .prepare(`SELECT COUNT(*) AS count FROM disconnection_tickets WHERE status = 'open' AND submitted_by_discord_id = ?`)
    .bind(discordUserId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

interface Submitter {
  readonly discordUserId: string;
  readonly displayName: string;
  readonly username: string;
  /** Ruolo Discord dell'equipaggio di chi manda il ticket. */
  readonly crewRoleId: string;
}

export async function insertTicket(
  database: SqlDatabase,
  ticket: DisconnectionTicketDraft,
  crew: TicketCrewOption,
  submitter: Submitter,
): Promise<DisconnectionTicket> {
  const inserted = await database
    .prepare(
      `INSERT INTO disconnection_tickets
         (crew_id, crew_number, crew_name, position, gap_ms, disconnected_on_lap, submitted_by_discord_id, submitted_by_name, submitted_by_username, crew_role_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING ${TICKET_COLUMNS}`,
    )
    .bind(crew.id, crew.number, crew.name, ticket.position, ticket.gapMs, ticket.disconnectedOnLap, submitter.discordUserId, submitter.displayName, submitter.username, submitter.crewRoleId)
    .first<DisconnectionTicket>();
  if (!inserted) throw new Error('Ticket non salvato');
  return inserted;
}

/** Ticket da gestire, dal più vecchio. */
export async function listOpenTickets(database: SqlDatabase): Promise<DisconnectionTicket[]> {
  const { results } = await database
    .prepare(`SELECT ${TICKET_COLUMNS} FROM disconnection_tickets WHERE status = 'open' ORDER BY id`)
    .all<DisconnectionTicket>();
  return results;
}

/** Chiude il ticket con il dettaglio del calcolo; 'not-found' o 'already-resolved' se non si può. */
export async function resolveTicket(
  database: SqlDatabase,
  ticketId: number,
  details: TicketResultDetails,
  resolvedByDiscordId: string,
): Promise<'resolved' | 'not-found' | 'already-resolved'> {
  const updated = await database
    .prepare(
      `UPDATE disconnection_tickets
       SET status = 'resolved', waiting_time_ms = ?, result_json = ?, resolved_by_discord_id = ?,
           resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = 'open' RETURNING id`,
    )
    .bind(waitingTimeMsOf(details), JSON.stringify(details), resolvedByDiscordId, ticketId)
    .first<{ id: number }>();
  if (updated) return 'resolved';
  const existing = await database.prepare('SELECT id FROM disconnection_tickets WHERE id = ?').bind(ticketId).first<{ id: number }>();
  return existing ? 'already-resolved' : 'not-found';
}

/** Dati per il messaggio del bot: il ticket, il ruolo da menzionare e il canale dell'equipaggio (se c'è ancora). */
export interface TicketNoticeTarget {
  readonly id: number;
  readonly crewNumber: number;
  readonly crewName: string;
  readonly position: number;
  readonly gapMs: number;
  readonly disconnectedOnLap: number;
  readonly crewRoleId: string | null;
  readonly discordChannelId: string | null;
}

export async function findTicketNoticeTarget(database: SqlDatabase, ticketId: number): Promise<TicketNoticeTarget | null> {
  return database
    .prepare(
      `SELECT t.id, t.crew_number AS crewNumber, t.crew_name AS crewName, t.position, t.gap_ms AS gapMs,
              t.disconnected_on_lap AS disconnectedOnLap, t.crew_role_id AS crewRoleId, c.discord_channel_id AS discordChannelId
       FROM disconnection_tickets t LEFT JOIN crews c ON c.id = t.crew_id
       WHERE t.id = ?`,
    )
    .bind(ticketId)
    .first<TicketNoticeTarget>();
}

interface SiteTicketRow extends DisconnectionTicket {
  readonly status: 'open' | 'resolved';
  readonly resolvedAt: string | null;
  readonly resultJson: string | null;
}

const SITE_TICKET_COLUMNS = `${TICKET_COLUMNS}, status, resolved_at AS resolvedAt, result_json AS resultJson`;

const toSiteTicket = ({ resultJson, ...row }: SiteTicketRow): SiteDisconnectionTicket => {
  let result: TicketResultDetails | null = null;
  try {
    result = resultJson ? readTicketResultDetails(JSON.parse(resultJson)) : null;
  } catch {
    result = null;
  }
  return { ...row, result };
};

/** Ticket mandati da una persona, dal più recente (gli ultimi 50). */
/** Chi guarda dal sito: il suo ID Discord e i suoi ruoli nel server della lega. */
export interface TicketViewer {
  readonly discordUserId: string;
  readonly roleIds: readonly string[];
}

/**
 * Un ticket è visibile a chi l'ha mandato e a chi ha lo stesso ruolo di equipaggio di chi l'ha mandato
 * (salvato nel ticket all'invio). I ruoli passano come un solo parametro JSON.
 */
const VISIBLE_TO_VIEWER = `(submitted_by_discord_id = ? OR crew_role_id IN (SELECT value FROM json_each(?)))`;

/** Ticket visibili a chi guarda (i propri e quelli del suo equipaggio), dal più recente. */
export async function listTicketsVisibleTo(database: SqlDatabase, viewer: TicketViewer): Promise<SiteDisconnectionTicket[]> {
  const { results } = await database
    .prepare(`SELECT ${SITE_TICKET_COLUMNS} FROM disconnection_tickets WHERE ${VISIBLE_TO_VIEWER} ORDER BY id DESC LIMIT 50`)
    .bind(viewer.discordUserId, JSON.stringify(viewer.roleIds))
    .all<SiteTicketRow>();
  return results.map(toSiteTicket);
}

/** Un ticket visibile a chi guarda (null se non esiste o non è suo né del suo equipaggio). */
export async function findTicketVisibleTo(database: SqlDatabase, ticketId: number, viewer: TicketViewer): Promise<SiteDisconnectionTicket | null> {
  const row = await database
    .prepare(`SELECT ${SITE_TICKET_COLUMNS} FROM disconnection_tickets WHERE id = ? AND ${VISIBLE_TO_VIEWER}`)
    .bind(ticketId, viewer.discordUserId, JSON.stringify(viewer.roleIds))
    .first<SiteTicketRow>();
  return row ? toSiteTicket(row) : null;
}
