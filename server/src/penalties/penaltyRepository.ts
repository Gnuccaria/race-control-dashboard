import {
  type PenaltyCrewDecision,
  type PenaltyDraft,
  reprimandCycleNumber,
  type SavedEnglishPenaltyText,
  type SavedPenalty,
} from '../../../shared/penaltyRules';
import type { SqlDatabase } from '../database/sqlDatabase';

interface PenaltyRow {
  readonly id: number;
  readonly raceId: number;
  readonly violation: string;
  readonly document: SavedPenalty['document'];
  readonly reason: string;
  readonly updatedAt: string;
  /** Vetture coinvolte con la loro decisione, come array JSON in ordine di id. */
  readonly crewsJson: string;
  readonly reasonEn: string | null;
  readonly englishSource: SavedEnglishPenaltyText['source'] | null;
  readonly englishOutdated: number;
}

/** Traduzione inglese da salvare con la penalità (null = nessuna). */
export type EnglishTextToSave = SavedEnglishPenaltyText | null;

const PENALTY_SELECT = `
  SELECT penalties.id, penalties.race_id AS raceId, penalties.violation, penalties.document, penalties.reason,
         penalties.updated_at AS updatedAt, penalties.reason_en AS reasonEn, penalties.english_source AS englishSource,
         penalties.english_outdated AS englishOutdated,
         (SELECT json_group_array(json_object('crewId', crew_id, 'decision', decision))
          FROM (SELECT crew_id, decision FROM penalty_crews WHERE penalty_id = penalties.id ORDER BY crew_id)) AS crewsJson
  FROM penalties`;

const NOW_TIMESTAMP = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

interface ReprimandRow {
  readonly penaltyId: number;
  readonly crewId: number;
  readonly raceId: number;
  readonly raceDate: string;
  readonly round: number;
}

/** Tutte le reprimende del campionato della gara, in ordine: gare per data e round, poi ordine di inserimento. */
async function listChampionshipReprimands(database: SqlDatabase, raceId: number): Promise<ReprimandRow[]> {
  const { results } = await database
    .prepare(
      `SELECT penalty_crews.penalty_id AS penaltyId, penalty_crews.crew_id AS crewId, races.id AS raceId, races.race_date AS raceDate, races.round
       FROM penalty_crews
       JOIN penalties ON penalties.id = penalty_crews.penalty_id
       JOIN races ON races.id = penalties.race_id
       WHERE penalty_crews.decision = 'reprimand' AND races.championship = (SELECT championship FROM races WHERE id = ?)
       ORDER BY races.race_date, races.round, penalties.id`,
    )
    .bind(raceId)
    .all<ReprimandRow>();
  return results;
}

/** "penaltyId:crewId" → numero della reprimenda nel ciclo della vettura (1–3). */
async function reprimandNumbers(database: SqlDatabase, raceId: number): Promise<Map<string, number>> {
  const ordinalByCrew = new Map<number, number>();
  const numbers = new Map<string, number>();
  for (const reprimand of await listChampionshipReprimands(database, raceId)) {
    const ordinal = (ordinalByCrew.get(reprimand.crewId) ?? 0) + 1;
    ordinalByCrew.set(reprimand.crewId, ordinal);
    numbers.set(`${reprimand.penaltyId}:${reprimand.crewId}`, reprimandCycleNumber(ordinal));
  }
  return numbers;
}

/**
 * Reprimende di ogni vettura che vengono prima di una penalità di questa gara: quelle delle gare precedenti
 * e, in questa gara, quelle inserite prima di beforePenaltyId (o tutte, per una penalità nuova).
 */
export async function countReprimandsBefore(database: SqlDatabase, raceId: number, beforePenaltyId: number | null): Promise<Map<number, number>> {
  const race = await database.prepare('SELECT race_date AS raceDate, round FROM races WHERE id = ?').bind(raceId).first<{ raceDate: string; round: number }>();
  const counts = new Map<number, number>();
  if (!race) return counts;
  for (const reprimand of await listChampionshipReprimands(database, raceId)) {
    const isLaterRace = reprimand.raceDate > race.raceDate || (reprimand.raceDate === race.raceDate && reprimand.round > race.round);
    const isLaterInThisRace = reprimand.raceId === raceId && beforePenaltyId !== null && reprimand.penaltyId >= beforePenaltyId;
    // La lista è in ordine: da qui in poi le reprimende vengono tutte dopo.
    if (isLaterRace || isLaterInThisRace) break;
    counts.set(reprimand.crewId, (counts.get(reprimand.crewId) ?? 0) + 1);
  }
  return counts;
}

const toSavedPenalty = (
  { crewsJson, reasonEn, englishSource, englishOutdated, ...row }: PenaltyRow,
  numbers: ReadonlyMap<string, number>,
): SavedPenalty => ({
  ...row,
  english:
    reasonEn === null || englishSource === null
      ? null
      : { reason: reasonEn, source: englishSource, isOutdated: englishOutdated === 1 },
  crews: (JSON.parse(crewsJson) as PenaltyCrewDecision[]).map((crew) => ({
    ...crew,
    reprimandNumber: crew.decision === 'reprimand' ? (numbers.get(`${row.id}:${crew.crewId}`) ?? null) : null,
  })),
});

/** Vetture e decisioni da un solo parametro JSON. */
const PENALTY_CREWS_FROM_JSON = "json_extract(value, '$.crewId'), json_extract(value, '$.decision') FROM json_each(?)";

/** Penalità di una gara, nell'ordine in cui sono state aggiunte. */
export async function listPenalties(database: SqlDatabase, raceId: number): Promise<SavedPenalty[]> {
  const { results } = await database.prepare(`${PENALTY_SELECT} WHERE penalties.race_id = ? ORDER BY penalties.id`).bind(raceId).all<PenaltyRow>();
  const numbers = await reprimandNumbers(database, raceId);
  return results.map((row) => toSavedPenalty(row, numbers));
}

export async function findPenalty(database: SqlDatabase, raceId: number, penaltyId: number): Promise<SavedPenalty | null> {
  const row = await database
    .prepare(`${PENALTY_SELECT} WHERE penalties.race_id = ? AND penalties.id = ?`)
    .bind(raceId, penaltyId)
    .first<PenaltyRow>();
  return row ? toSavedPenalty(row, await reprimandNumbers(database, raceId)) : null;
}

/** Penalità e vetture coinvolte (con la loro decisione) in un'unica transazione. */
/** Valori delle colonne della traduzione: reason_en, english_source, english_outdated. */
const englishColumns = (english: EnglishTextToSave) =>
  english === null ? [null, null, 0] : [english.reason, english.source, english.isOutdated ? 1 : 0];

export async function insertPenalty(
  database: SqlDatabase,
  raceId: number,
  penalty: PenaltyDraft,
  english: EnglishTextToSave,
  createdByDiscordId: string,
): Promise<SavedPenalty> {
  const [insertedPenalty] = await database.batch<{ id: number }>([
    database
      .prepare(
        `INSERT INTO penalties (race_id, violation, document, reason, reason_en, english_source, english_outdated, created_by_discord_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(raceId, penalty.violation, penalty.document, penalty.reason, ...englishColumns(english), createdByDiscordId),
    // La penalità appena inserita è l'ultima della gara.
    database
      .prepare(`INSERT INTO penalty_crews (penalty_id, crew_id, decision) SELECT (SELECT MAX(id) FROM penalties WHERE race_id = ?), ${PENALTY_CREWS_FROM_JSON}`)
      .bind(raceId, JSON.stringify(penalty.crews)),
  ]);

  const penaltyId = insertedPenalty?.results[0]?.id;
  const savedPenalty = penaltyId === undefined ? null : await findPenalty(database, raceId, penaltyId);
  if (!savedPenalty) throw new Error('Il database non ha restituito la penalità inserita.');
  return savedPenalty;
}

/** Aggiorna la penalità e sostituisce le vetture coinvolte; null se non esiste in questa gara. */
export async function updatePenalty(
  database: SqlDatabase,
  raceId: number,
  penaltyId: number,
  penalty: PenaltyDraft,
  english: EnglishTextToSave,
): Promise<SavedPenalty | null> {
  if (!(await findPenalty(database, raceId, penaltyId))) return null;
  await database.batch([
    database
      .prepare(
        `UPDATE penalties SET violation = ?, document = ?, reason = ?, reason_en = ?, english_source = ?, english_outdated = ?,
           updated_at = ${NOW_TIMESTAMP}
         WHERE id = ? AND race_id = ?`,
      )
      .bind(penalty.violation, penalty.document, penalty.reason, ...englishColumns(english), penaltyId, raceId),
    database.prepare('DELETE FROM penalty_crews WHERE penalty_id = ?').bind(penaltyId),
    database
      .prepare(`INSERT INTO penalty_crews (penalty_id, crew_id, decision) SELECT ?, ${PENALTY_CREWS_FROM_JSON}`)
      .bind(penaltyId, JSON.stringify(penalty.crews)),
  ]);
  return findPenalty(database, raceId, penaltyId);
}

/** Elimina le penalità indicate di questa gara (le altre vengono ignorate); restituisce quante sono state eliminate. */
export async function deletePenalties(database: SqlDatabase, raceId: number, penaltyIds: readonly number[]): Promise<number> {
  const idsJson = JSON.stringify(penaltyIds);
  const [, deletedPenalties] = await database.batch<{ id: number }>([
    database
      .prepare('DELETE FROM penalty_crews WHERE penalty_id IN (SELECT id FROM penalties WHERE race_id = ? AND id IN (SELECT value FROM json_each(?)))')
      .bind(raceId, idsJson),
    database.prepare('DELETE FROM penalties WHERE race_id = ? AND id IN (SELECT value FROM json_each(?)) RETURNING id').bind(raceId, idsJson),
  ]);
  return deletedPenalties?.results.length ?? 0;
}
