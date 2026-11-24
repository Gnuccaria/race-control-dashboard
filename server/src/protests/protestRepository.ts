import { openProtestSession, type ProtestSession } from '../../../shared/protestTimingRules';
import {
  isProtestVideoExpired,
  isProtestVideoType,
  isProtestVideoWindowOpen,
  type Protest,
  type ProtestCrew,
  type ProtestDraft,
  type ProtestPenalty,
  type ProtestRace,
  type ProtestRaceOption,
  type ProtestStatus,
  type SiteProtest,
} from '../../../shared/protestRules';
import type { CrewChampionship } from '../../../shared/crewRules';
import type { SqlDatabase } from '../database/sqlDatabase';
import { findPenalty } from '../penalties/penaltyRepository';

interface ProtestRow {
  readonly id: number;
  readonly crewId: number;
  readonly crewNumber: number;
  readonly crewName: string;
  readonly championship: string | null;
  readonly session: ProtestSession;
  readonly stint: number | null;
  readonly lap: number;
  readonly corner: string;
  readonly description: string;
  readonly youtubeVideoId: string | null;
  readonly otherCrewsJson: string;
  readonly videoKey: string | null;
  readonly videoContentType: string | null;
  readonly videoSize: number | null;
  readonly submittedByName: string;
  readonly submittedByUsername: string;
  readonly createdAt: string;
  readonly submittedBy: string;
  readonly crewRoleId: string | null;
  readonly status: ProtestStatus;
  readonly rejectionReason: string | null;
  readonly reviewedAt: string | null;
  readonly raceId: number | null;
  readonly raceName: string | null;
  readonly raceRound: number | null;
  readonly raceChampionship: CrewChampionship | null;
  readonly penaltyId: number | null;
}

/** Protesta con la sua gara (se c'è): nome, round e campionato letti dalla gara. */
const PROTEST_SELECT = `
  SELECT protests.id, protests.crew_id AS crewId, protests.crew_number AS crewNumber, protests.crew_name AS crewName,
    protests.championship, protests.session, protests.stint, protests.lap, protests.corner, protests.description,
    protests.youtube_video_id AS youtubeVideoId, protests.other_crews_json AS otherCrewsJson, protests.video_key AS videoKey,
    protests.video_content_type AS videoContentType, protests.video_size AS videoSize, protests.submitted_by_name AS submittedByName,
    protests.submitted_by_username AS submittedByUsername, protests.created_at AS createdAt,
    protests.submitted_by_discord_id AS submittedBy, protests.crew_role_id AS crewRoleId, protests.status,
    protests.rejection_reason AS rejectionReason, protests.reviewed_at AS reviewedAt, protests.penalty_id AS penaltyId,
    races.id AS raceId, races.name AS raceName, races.round AS raceRound, races.championship AS raceChampionship
  FROM protests LEFT JOIN races ON races.id = protests.race_id`;

function readOtherCrews(json: string): ProtestCrew[] {
  try {
    const crews = JSON.parse(json) as unknown;
    return Array.isArray(crews) ? (crews as ProtestCrew[]) : [];
  } catch {
    return [];
  }
}

const toProtestRace = (row: ProtestRow): ProtestRace | null =>
  row.raceId !== null && row.raceRound !== null && row.raceChampionship !== null
    ? { id: row.raceId, name: row.raceName, round: row.raceRound, championship: row.raceChampionship }
    : null;

/** Dati della protesta che vedono sia l'app sia il sito (dell'esito solo lo stato). */
const toSharedProtest = (row: ProtestRow): Omit<Protest, 'rejectionReason' | 'penalty'> => ({
  id: row.id,
  crew: { id: row.crewId, number: row.crewNumber, name: row.crewName },
  championship: row.championship,
  race: toProtestRace(row),
  session: row.session,
  stint: row.stint,
  lap: row.lap,
  corner: row.corner,
  description: row.description,
  youtubeVideoId: row.youtubeVideoId,
  otherCrews: readOtherCrews(row.otherCrewsJson),
  video:
    row.videoKey && isProtestVideoType(row.videoContentType) && row.videoSize !== null
      ? { contentType: row.videoContentType, size: row.videoSize, isExpired: isProtestVideoExpired(row.createdAt) }
      : null,
  submittedByName: row.submittedByName,
  submittedByUsername: row.submittedByUsername,
  createdAt: row.createdAt,
  status: row.status,
  reviewedAt: row.reviewedAt,
});

/** Protesta per l'app; penalty: la penalità della protesta accolta, letta a parte (solo nel dettaglio; nell'elenco null). */
const toProtest = (row: ProtestRow, penalty: ProtestPenalty | null = null): Protest => ({
  ...toSharedProtest(row),
  rejectionReason: row.status === 'rejected' ? (row.rejectionReason ?? '') : null,
  penalty,
});

/** Chi guarda dal sito: il suo ID Discord e i suoi ruoli nel server della lega. */
export interface ProtestViewer {
  readonly discordUserId: string;
  readonly roleIds: readonly string[];
}

/** Vista del sito: cosa può ancora aggiungere chi guarda (solo chi l'ha mandata, entro 24 ore dall'invio). */
function toSiteProtest(row: ProtestRow, viewer: ProtestViewer): SiteProtest {
  const canAdd = row.submittedBy === viewer.discordUserId && isProtestVideoWindowOpen(row.createdAt);
  // Dell'esito il sito vede solo lo stato: niente motivazione del rifiuto né penalità.
  return { ...toSharedProtest(row), canAddVideo: canAdd && row.videoKey === null, canAddYoutube: canAdd && row.youtubeVideoId === null };
}

/** Visibile a chi l'ha mandata e a chi ha lo stesso ruolo di equipaggio (salvato all'invio). */
const VISIBLE_TO_VIEWER = '(submitted_by_discord_id = ? OR crew_role_id IN (SELECT value FROM json_each(?)))';

export async function listProtestsVisibleTo(database: SqlDatabase, viewer: ProtestViewer): Promise<SiteProtest[]> {
  const { results } = await database
    .prepare(`${PROTEST_SELECT} WHERE ${VISIBLE_TO_VIEWER} ORDER BY protests.id DESC LIMIT 50`)
    .bind(viewer.discordUserId, JSON.stringify(viewer.roleIds))
    .all<ProtestRow>();
  return results.map((row) => toSiteProtest(row, viewer));
}

export async function findProtestVisibleTo(database: SqlDatabase, protestId: number, viewer: ProtestViewer): Promise<SiteProtest | null> {
  const row = await database
    .prepare(`${PROTEST_SELECT} WHERE protests.id = ? AND ${VISIBLE_TO_VIEWER}`)
    .bind(protestId, viewer.discordUserId, JSON.stringify(viewer.roleIds))
    .first<ProtestRow>();
  return row ? toSiteProtest(row, viewer) : null;
}

/** Chiave del video e data d'invio, se chi guarda può vedere la protesta. */
export async function findVisibleProtestVideo(
  database: SqlDatabase,
  protestId: number,
  viewer: ProtestViewer,
): Promise<{ readonly videoKey: string | null; readonly createdAt: string } | null> {
  return database
    .prepare(`SELECT video_key AS videoKey, created_at AS createdAt FROM protests WHERE id = ? AND ${VISIBLE_TO_VIEWER}`)
    .bind(protestId, viewer.discordUserId, JSON.stringify(viewer.roleIds))
    .first<{ videoKey: string | null; createdAt: string }>();
}

/** Esito di un tentativo di decidere: fatto, protesta già decisa (definitiva) o inesistente. */
export type ProtestDecisionOutcome = 'done' | 'already-reviewed' | 'not-found';

async function decisionOutcome(database: SqlDatabase, protestId: number, isDone: boolean): Promise<ProtestDecisionOutcome> {
  if (isDone) return 'done';
  const existing = await database.prepare('SELECT id FROM protests WHERE id = ?').bind(protestId).first<{ id: number }>();
  return existing ? 'already-reviewed' : 'not-found';
}

/** Respinge la protesta con la motivazione, solo se è ancora in esame (l'esito è definitivo). */
export async function rejectProtest(database: SqlDatabase, protestId: number, reason: string, reviewedByDiscordId: string): Promise<ProtestDecisionOutcome> {
  const row = await database
    .prepare(
      `UPDATE protests SET status = 'rejected', rejection_reason = ?, reviewed_by_discord_id = ?,
         reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = 'open' RETURNING id`,
    )
    .bind(reason, reviewedByDiscordId, protestId)
    .first<{ id: number }>();
  return decisionOutcome(database, protestId, row !== null);
}

/**
 * Prima metà dell'accoglimento: segna la protesta come accolta solo se è ancora in esame, così due salvataggi
 * contemporanei non creano due penalità. Poi si crea la penalità e la si collega (linkProtestPenalty); se la
 * penalità non si salva, reopenProtest la rimette in esame.
 */
export async function claimProtestForAcceptance(database: SqlDatabase, protestId: number, reviewedByDiscordId: string): Promise<ProtestDecisionOutcome> {
  const row = await database
    .prepare(
      `UPDATE protests SET status = 'accepted', reviewed_by_discord_id = ?, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = 'open' AND race_id IS NOT NULL RETURNING id`,
    )
    .bind(reviewedByDiscordId, protestId)
    .first<{ id: number }>();
  return decisionOutcome(database, protestId, row !== null);
}

export async function linkProtestPenalty(database: SqlDatabase, protestId: number, penaltyId: number): Promise<void> {
  await database.prepare('UPDATE protests SET penalty_id = ? WHERE id = ?').bind(penaltyId, protestId).run();
}

export async function reopenProtest(database: SqlDatabase, protestId: number): Promise<void> {
  await database
    .prepare("UPDATE protests SET status = 'open', reviewed_by_discord_id = NULL, reviewed_at = NULL, penalty_id = NULL WHERE id = ?")
    .bind(protestId)
    .run();
}

/** Aggiunge il link YouTube, solo se non ce n'era già uno; false altrimenti. */
export async function attachProtestYoutube(database: SqlDatabase, protestId: number, youtubeVideoId: string): Promise<boolean> {
  const row = await database
    .prepare('UPDATE protests SET youtube_video_id = ? WHERE id = ? AND youtube_video_id IS NULL RETURNING id')
    .bind(youtubeVideoId, protestId)
    .first<{ id: number }>();
  return row !== null;
}

/**
 * Gli altri equipaggi dei campionati indicati (escluso il proprio), con colore e campionati: il sito mostra quelli
 * del campionato della gara scelta.
 */
export async function listCrewsOfChampionships(
  database: SqlDatabase,
  championships: readonly string[],
  excludedCrewId: number,
): Promise<(ProtestCrew & { readonly color: string | null; readonly championships: readonly string[] })[]> {
  const { results } = await database
    .prepare(
      `SELECT crews.id, crews.number, crews.name, crews.color, group_concat(crew_championships.championship, '|') AS championshipsText
       FROM crews JOIN crew_championships ON crew_championships.crew_id = crews.id
       WHERE crew_championships.championship IN (SELECT value FROM json_each(?)) AND crews.id <> ?
       GROUP BY crews.id ORDER BY crews.number`,
    )
    .bind(JSON.stringify(championships), excludedCrewId)
    .all<ProtestCrew & { color: string | null; championshipsText: string }>();
  return results.map(({ championshipsText, ...crew }) => ({ ...crew, championships: championshipsText.split('|') }));
}

/** Gli altri equipaggi di un campionato, tra cui scegliere quelli coinvolti (escluso il proprio), con il colore. */
export async function listChampionshipCrews(
  database: SqlDatabase,
  championship: string,
  excludedCrewId: number,
): Promise<(ProtestCrew & { readonly color: string | null })[]> {
  const { results } = await database
    .prepare(
      `SELECT crews.id, crews.number, crews.name, crews.color FROM crews
       JOIN crew_championships ON crew_championships.crew_id = crews.id AND crew_championships.championship = ?
       WHERE crews.id <> ? ORDER BY crews.number`,
    )
    .bind(championship, excludedCrewId)
    .all<ProtestCrew & { color: string | null }>();
  return results;
}

export async function countRecentProtestsBy(database: SqlDatabase, discordUserId: string): Promise<number> {
  const row = await database
    .prepare(
      `SELECT COUNT(*) AS count FROM protests
       WHERE submitted_by_discord_id = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`,
    )
    .bind(discordUserId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

interface ProtestSubmission {
  readonly crew: ProtestCrew;
  /** La gara scelta (ne copia il campionato nella protesta). */
  readonly race: ProtestRaceOption;
  readonly crewRoleId: string;
  readonly otherCrews: readonly ProtestCrew[];
  readonly discordUserId: string;
  readonly displayName: string;
  readonly username: string;
}

export async function insertProtest(database: SqlDatabase, protest: ProtestDraft, submission: ProtestSubmission): Promise<number> {
  const row = await database
    .prepare(
      `INSERT INTO protests (crew_id, crew_number, crew_name, crew_role_id, championship, race_id, session, stint, lap, corner, description,
         youtube_video_id, other_crews_json, submitted_by_discord_id, submitted_by_name, submitted_by_username)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      submission.crew.id,
      submission.crew.number,
      submission.crew.name,
      submission.crewRoleId,
      submission.race.championship,
      protest.raceId,
      submission.race.session,
      // Le proteste di qualifica non hanno stint.
      submission.race.session === 'qualifying' ? null : protest.stint,
      protest.lap,
      protest.corner,
      protest.description,
      protest.youtubeVideoId,
      JSON.stringify(submission.otherCrews.map(({ id, number, name }) => ({ id, number, name }))),
      submission.discordUserId,
      submission.displayName,
      submission.username,
    )
    .first<{ id: number }>();
  if (!row) throw new Error('Protesta non salvata');
  return row.id;
}

/** Chi ha mandato la protesta, se ha già un video e da quanti secondi esiste: per accettare il caricamento del video. */
export async function findProtestUploadState(
  database: SqlDatabase,
  protestId: number,
): Promise<{ readonly submittedBy: string; readonly hasVideo: boolean; readonly hasYoutube: boolean; readonly createdAt: string } | null> {
  const row = await database
    .prepare(
      `SELECT submitted_by_discord_id AS submittedBy, video_key IS NOT NULL AS hasVideo, youtube_video_id IS NOT NULL AS hasYoutube,
              created_at AS createdAt
       FROM protests WHERE id = ?`,
    )
    .bind(protestId)
    .first<{ submittedBy: string; hasVideo: number; hasYoutube: number; createdAt: string }>();
  return row ? { submittedBy: row.submittedBy, hasVideo: Boolean(row.hasVideo), hasYoutube: Boolean(row.hasYoutube), createdAt: row.createdAt } : null;
}

/** Collega il video alla protesta, solo se non ne aveva già uno; false se nel frattempo è stato collegato un altro. */
export async function attachProtestVideo(database: SqlDatabase, protestId: number, videoKey: string, contentType: string, size: number): Promise<boolean> {
  const row = await database
    .prepare('UPDATE protests SET video_key = ?, video_content_type = ?, video_size = ? WHERE id = ? AND video_key IS NULL RETURNING id')
    .bind(videoKey, contentType, size, protestId)
    .first<{ id: number }>();
  return row !== null;
}

/** Tutte le proteste, dalla più recente. */
export async function listProtests(database: SqlDatabase): Promise<Protest[]> {
  const { results } = await database.prepare(`${PROTEST_SELECT} ORDER BY protests.id DESC`).all<ProtestRow>();
  return results.map((row) => toProtest(row));
}

/**
 * Gare dei campionati indicati per cui adesso si possono mandare proteste, con la sessione aperta (qualifiche o gara,
 * dalle finestre del campionato), dalla più recente: il menu "Gara" del modulo del sito.
 */
export async function listRacesOpenForProtests(database: SqlDatabase, championships: readonly string[], now = Date.now()): Promise<ProtestRaceOption[]> {
  const { results } = await database
    .prepare(
      `SELECT races.id, races.name, races.round, races.championship, races.race_date AS raceDate, races.start_time AS startTime,
              races.end_date AS endDate, races.end_time AS endTime, championships.qualifying_advance_hours AS advanceHours,
              championships.qualifying_minutes AS qualifyingMinutes, championships.qualifying_protest_hours AS qualifyingProtestHours,
              championships.race_protest_hours AS raceProtestHours
       FROM races JOIN championships ON championships.name = races.championship
       WHERE races.championship IN (SELECT value FROM json_each(?)) AND races.start_time IS NOT NULL
       ORDER BY races.race_date DESC, races.round DESC`,
    )
    .bind(JSON.stringify(championships))
    .all<
      Omit<ProtestRaceOption, 'session'> & {
        startTime: string;
        endDate: string | null;
        endTime: string | null;
        advanceHours: number | null;
        qualifyingMinutes: number | null;
        qualifyingProtestHours: number | null;
        raceProtestHours: number;
      }
    >();
  return results.flatMap((race) => {
    const qualifying =
      race.advanceHours === null || race.qualifyingMinutes === null || race.qualifyingProtestHours === null
        ? null
        : { advanceHours: race.advanceHours, minutes: race.qualifyingMinutes, protestHours: race.qualifyingProtestHours };
    const session = openProtestSession(race, { qualifying, raceProtestHours: race.raceProtestHours }, now);
    return session === null ? [] : [{ id: race.id, name: race.name, round: race.round, championship: race.championship, raceDate: race.raceDate, session }];
  });
}

export async function findProtest(database: SqlDatabase, protestId: number): Promise<Protest | null> {
  const row = await database.prepare(`${PROTEST_SELECT} WHERE protests.id = ?`).bind(protestId).first<ProtestRow>();
  if (!row) return null;
  const penalty = row.penaltyId !== null && row.raceId !== null ? await findPenalty(database, row.raceId, row.penaltyId) : null;
  return toProtest(
    row,
    penalty
      ? {
          id: penalty.id,
          crews: penalty.crews.map(({ crewId, decision }) => ({ crewId, decision })),
          violation: penalty.violation,
          document: penalty.document,
          reason: penalty.reason,
        }
      : null,
  );
}

export async function findProtestVideo(database: SqlDatabase, protestId: number): Promise<{ readonly videoKey: string | null; readonly createdAt: string } | null> {
  return database
    .prepare('SELECT video_key AS videoKey, created_at AS createdAt FROM protests WHERE id = ?')
    .bind(protestId)
    .first<{ videoKey: string | null; createdAt: string }>();
}
