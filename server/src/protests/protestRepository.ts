import {
  isProtestVideoExpired,
  isProtestVideoType,
  isProtestVideoWindowOpen,
  type Protest,
  type ProtestCrew,
  type ProtestDraft,
  type ProtestReview,
  type ProtestStatus,
  type SiteProtest,
} from '../../../shared/protestRules';
import type { SqlDatabase } from '../database/sqlDatabase';

interface ProtestRow {
  readonly id: number;
  readonly crewId: number;
  readonly crewNumber: number;
  readonly crewName: string;
  readonly championship: string | null;
  readonly stint: number;
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
}

const PROTEST_COLUMNS = `
  id, crew_id AS crewId, crew_number AS crewNumber, crew_name AS crewName, championship, stint, lap, corner, description,
  youtube_video_id AS youtubeVideoId, other_crews_json AS otherCrewsJson, video_key AS videoKey,
  video_content_type AS videoContentType, video_size AS videoSize, submitted_by_name AS submittedByName,
  submitted_by_username AS submittedByUsername, created_at AS createdAt, submitted_by_discord_id AS submittedBy,
  crew_role_id AS crewRoleId, status, rejection_reason AS rejectionReason, reviewed_at AS reviewedAt`;

function readOtherCrews(json: string): ProtestCrew[] {
  try {
    const crews = JSON.parse(json) as unknown;
    return Array.isArray(crews) ? (crews as ProtestCrew[]) : [];
  } catch {
    return [];
  }
}

const toProtest = (row: ProtestRow): Protest => ({
  id: row.id,
  crew: { id: row.crewId, number: row.crewNumber, name: row.crewName },
  championship: row.championship,
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
  rejectionReason: row.status === 'rejected' ? (row.rejectionReason ?? '') : null,
  reviewedAt: row.reviewedAt,
});

/** Chi guarda dal sito: il suo ID Discord e i suoi ruoli nel server della lega. */
export interface ProtestViewer {
  readonly discordUserId: string;
  readonly roleIds: readonly string[];
}

/** Vista del sito: cosa può ancora aggiungere chi guarda (solo chi l'ha mandata, entro 24 ore dall'invio). */
function toSiteProtest(row: ProtestRow, viewer: ProtestViewer): SiteProtest {
  const canAdd = row.submittedBy === viewer.discordUserId && isProtestVideoWindowOpen(row.createdAt);
  return { ...toProtest(row), canAddVideo: canAdd && row.videoKey === null, canAddYoutube: canAdd && row.youtubeVideoId === null };
}

/** Visibile a chi l'ha mandata e a chi ha lo stesso ruolo di equipaggio (salvato all'invio). */
const VISIBLE_TO_VIEWER = '(submitted_by_discord_id = ? OR crew_role_id IN (SELECT value FROM json_each(?)))';

export async function listProtestsVisibleTo(database: SqlDatabase, viewer: ProtestViewer): Promise<SiteProtest[]> {
  const { results } = await database
    .prepare(`SELECT ${PROTEST_COLUMNS} FROM protests WHERE ${VISIBLE_TO_VIEWER} ORDER BY id DESC LIMIT 50`)
    .bind(viewer.discordUserId, JSON.stringify(viewer.roleIds))
    .all<ProtestRow>();
  return results.map((row) => toSiteProtest(row, viewer));
}

export async function findProtestVisibleTo(database: SqlDatabase, protestId: number, viewer: ProtestViewer): Promise<SiteProtest | null> {
  const row = await database
    .prepare(`SELECT ${PROTEST_COLUMNS} FROM protests WHERE id = ? AND ${VISIBLE_TO_VIEWER}`)
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

/** Salva l'esito: respinta con la motivazione, oppure di nuovo in esame. null se la protesta non esiste. */
/**
 * Respinge la protesta, solo se è ancora in esame (il rifiuto è definitivo): 'already-rejected' se era già respinta,
 * null se non esiste.
 */
export async function reviewProtest(
  database: SqlDatabase,
  protestId: number,
  review: ProtestReview,
  reviewedByDiscordId: string,
): Promise<Protest | 'already-rejected' | null> {
  const row = await database
    .prepare(
      `UPDATE protests SET status = 'rejected', rejection_reason = ?, reviewed_by_discord_id = ?,
         reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = 'open' RETURNING ${PROTEST_COLUMNS}`,
    )
    .bind(review.reason, reviewedByDiscordId, protestId)
    .first<ProtestRow>();
  if (row) return toProtest(row);
  const existing = await database.prepare('SELECT id FROM protests WHERE id = ?').bind(protestId).first<{ id: number }>();
  return existing ? 'already-rejected' : null;
}

/** Aggiunge il link YouTube, solo se non ce n'era già uno; false altrimenti. */
export async function attachProtestYoutube(database: SqlDatabase, protestId: number, youtubeVideoId: string): Promise<boolean> {
  const row = await database
    .prepare('UPDATE protests SET youtube_video_id = ? WHERE id = ? AND youtube_video_id IS NULL RETURNING id')
    .bind(youtubeVideoId, protestId)
    .first<{ id: number }>();
  return row !== null;
}

/** Gli equipaggi di tutti i campionati (escluso il proprio), con campionato e colore: il sito li filtra per campionato. */
export async function listCrewsOfChampionships(
  database: SqlDatabase,
  championships: readonly string[],
  excludedCrewId: number,
): Promise<(ProtestCrew & { readonly championship: string; readonly color: string | null })[]> {
  const { results } = await database
    .prepare('SELECT id, number, name, championship, color FROM crews WHERE championship IN (SELECT value FROM json_each(?)) AND id <> ? ORDER BY number')
    .bind(JSON.stringify(championships), excludedCrewId)
    .all<ProtestCrew & { championship: string; color: string | null }>();
  return results;
}

/** Gli altri equipaggi di un campionato, tra cui scegliere quelli coinvolti (escluso il proprio), con il colore. */
export async function listChampionshipCrews(
  database: SqlDatabase,
  championship: string,
  excludedCrewId: number,
): Promise<(ProtestCrew & { readonly color: string | null })[]> {
  const { results } = await database
    .prepare('SELECT id, number, name, color FROM crews WHERE championship = ? AND id <> ? ORDER BY number')
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
  readonly crew: ProtestCrew & { readonly championship: string | null };
  readonly crewRoleId: string;
  readonly otherCrews: readonly ProtestCrew[];
  readonly discordUserId: string;
  readonly displayName: string;
  readonly username: string;
}

export async function insertProtest(database: SqlDatabase, protest: ProtestDraft, submission: ProtestSubmission): Promise<number> {
  const row = await database
    .prepare(
      `INSERT INTO protests (crew_id, crew_number, crew_name, crew_role_id, championship, stint, lap, corner, description,
         youtube_video_id, other_crews_json, submitted_by_discord_id, submitted_by_name, submitted_by_username)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      submission.crew.id,
      submission.crew.number,
      submission.crew.name,
      submission.crewRoleId,
      protest.championship,
      protest.stint,
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
  const { results } = await database.prepare(`SELECT ${PROTEST_COLUMNS} FROM protests ORDER BY id DESC`).all<ProtestRow>();
  return results.map(toProtest);
}

export async function findProtest(database: SqlDatabase, protestId: number): Promise<Protest | null> {
  const row = await database.prepare(`SELECT ${PROTEST_COLUMNS} FROM protests WHERE id = ?`).bind(protestId).first<ProtestRow>();
  return row ? toProtest(row) : null;
}

export async function findProtestVideo(database: SqlDatabase, protestId: number): Promise<{ readonly videoKey: string | null; readonly createdAt: string } | null> {
  return database
    .prepare('SELECT video_key AS videoKey, created_at AS createdAt FROM protests WHERE id = ?')
    .bind(protestId)
    .first<{ videoKey: string | null; createdAt: string }>();
}
