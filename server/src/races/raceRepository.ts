import type { CrewChampionship } from '../../../shared/crewRules';
import { formatCarName } from '../../../shared/carRules';
import { type DriverSwapEntry, type SavedDriverSwap, withDriverSwapPenalties } from '../../../shared/driverSwapRules';
import type { PublicRaceResult, RaceDraft, RaceDuration, RaceSummary, SavedRace, SavedRaceResult } from '../../../shared/raceRules';
import type { SqlDatabase } from '../database/sqlDatabase';

interface RaceRow {
  readonly id: number;
  readonly name: string | null;
  readonly championship: CrewChampionship;
  readonly duration: RaceDuration | null;
  readonly total_laps: number | null;
  readonly round: number;
  readonly track_id: number | null;
  readonly track_name: string | null;
  readonly track_configuration: string | null;
  readonly is_track_reversed: number;
  readonly race_date: string;
  readonly updated_at: string;
  readonly start_time: string | null;
  readonly end_date: string | null;
  readonly end_time: string | null;
}

const RACE_SUMMARY_SELECT = `
  SELECT races.id, races.name, races.championship, races.duration, races.total_laps, races.round, races.track_id, tracks.name AS track_name, tracks.configuration AS track_configuration,
         races.is_track_reversed, races.race_date, races.start_time, races.end_date, races.end_time, races.updated_at
  FROM races LEFT JOIN tracks ON tracks.id = races.track_id`;

const NOW_TIMESTAMP = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const toRaceSummary = (row: RaceRow): RaceSummary => ({
  id: row.id,
  name: row.name,
  championship: row.championship,
  duration: row.duration,
  totalLaps: row.total_laps,
  round: row.round,
  trackId: row.track_id,
  trackName: row.track_name,
  trackConfiguration: row.track_configuration,
  isTrackReversed: row.is_track_reversed === 1,
  raceDate: row.race_date,
  startTime: row.start_time,
  endDate: row.end_date,
  endTime: row.end_time,
  updatedAt: row.updated_at,
});

/** Classifica (con la vettura di ogni riga) come un solo parametro JSON: D1 limita il numero di parametri per query. */
const toResultsJson = (results: readonly SavedRaceResult[]) => JSON.stringify(results);

const RESULT_COLUMNS_FROM_JSON =
  "json_extract(value, '$.position'), json_extract(value, '$.crewId'), json_extract(value, '$.laps'), json_extract(value, '$.carId'), json_extract(value, '$.gapMs')";

/** Ordine di arrivo salvato di una gara, in ordine di posizione. */
export async function listRaceResults(database: SqlDatabase, raceId: number): Promise<SavedRaceResult[]> {
  const { results } = await database
    .prepare('SELECT position, crew_id AS crewId, laps, gap AS gapMs, car_id AS carId FROM race_results WHERE race_id = ? ORDER BY position')
    .bind(raceId)
    .all<SavedRaceResult>();
  return results;
}

/** Righe dei cambi pilota salvate con la gara, per cambio ed equipaggio. */
export async function listDriverSwaps(database: SqlDatabase, raceId: number): Promise<SavedDriverSwap[]> {
  const { results } = await database
    .prepare(
      `SELECT swap, crew_id AS crewId, pit_in AS pitInMs, pit_out AS pitOutMs, penalty AS penaltyMs, is_cancelled AS isCancelled, notes
       FROM driver_swaps WHERE race_id = ? ORDER BY swap, crew_id`,
    )
    .bind(raceId)
    .all<Omit<SavedDriverSwap, 'isCancelled'> & { isCancelled: number }>();
  return results.map((row) => ({ ...row, isCancelled: row.isCancelled === 1 }));
}

const DRIVER_SWAP_INSERT_COLUMNS = '(race_id, swap, crew_id, pit_in, pit_out, penalty, is_cancelled, notes)';
const DRIVER_SWAP_COLUMNS_FROM_JSON =
  "json_extract(value, '$.swap'), json_extract(value, '$.crewId'), json_extract(value, '$.pitInMs'), json_extract(value, '$.pitOutMs'), json_extract(value, '$.penaltyMs'), json_extract(value, '$.isCancelled'), json_extract(value, '$.notes')";

/** Righe da salvare, con la penalità ricalcolata qui: quella mandata dall'app non conta. */
const toDriverSwapsJson = (driverSwaps: readonly DriverSwapEntry[]) =>
  JSON.stringify(withDriverSwapPenalties(driverSwaps).map((row) => ({ ...row, isCancelled: row.isCancelled ? 1 : 0 })));

/** Classifica per il sito pubblico: numero, nome e colore dell'equipaggio, nome della vettura usata in quella gara. */
export async function listPublicRaceResults(database: SqlDatabase, raceId: number): Promise<PublicRaceResult[]> {
  const { results } = await database
    .prepare(
      `SELECT race_results.position, race_results.laps, race_results.gap AS gapMs, crews.number AS crewNumber, crews.name AS crewName,
              crews.color AS crewColor, cars.manufacturer AS carManufacturer, cars.model AS carModel
       FROM race_results
       JOIN crews ON crews.id = race_results.crew_id
       LEFT JOIN cars ON cars.id = race_results.car_id
       WHERE race_results.race_id = ?
       ORDER BY race_results.position`,
    )
    .bind(raceId)
    .all<Omit<PublicRaceResult, 'carName'> & { carManufacturer: string | null; carModel: string | null }>();
  return results.map(({ carManufacturer, carModel, ...result }) => ({
    ...result,
    carName: carManufacturer === null ? null : formatCarName({ manufacturer: carManufacturer, model: carModel }),
  }));
}

/** Auto attuale di ogni equipaggio indicato (null se non ne ha una). */
export async function findCrewCarIds(database: SqlDatabase, crewIds: readonly number[]): Promise<Map<number, number | null>> {
  if (crewIds.length === 0) return new Map();
  const { results } = await database
    .prepare('SELECT id, car_id AS carId FROM crews WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(crewIds))
    .all<{ id: number; carId: number | null }>();
  return new Map(results.map((crew) => [crew.id, crew.carId]));
}

/** Dalle gare più recenti alle più vecchie. */
export async function listRaces(database: SqlDatabase): Promise<RaceSummary[]> {
  const { results } = await database
    .prepare(`${RACE_SUMMARY_SELECT} ORDER BY races.race_date DESC, races.round DESC`)
    .all<RaceRow>();
  return results.map(toRaceSummary);
}

export async function findRaceSummaryById(database: SqlDatabase, raceId: number): Promise<RaceSummary | null> {
  const row = await database.prepare(`${RACE_SUMMARY_SELECT} WHERE races.id = ?`).bind(raceId).first<RaceRow>();
  return row ? toRaceSummary(row) : null;
}

export async function findRaceById(database: SqlDatabase, raceId: number): Promise<SavedRace | null> {
  const row = await database.prepare(`${RACE_SUMMARY_SELECT} WHERE races.id = ?`).bind(raceId).first<RaceRow>();
  if (!row) return null;
  return {
    ...toRaceSummary(row),
    results: await listRaceResults(database, raceId),
    driverSwaps: await listDriverSwaps(database, raceId),
  };
}

/** Esiste già un'altra gara con lo stesso round nello stesso campionato? */
export async function isRaceRoundTaken(database: SqlDatabase, race: RaceDraft, excludedRaceId = -1): Promise<boolean> {
  const sameRound = await database
    .prepare('SELECT id FROM races WHERE championship = ? AND round = ? AND id <> ?')
    .bind(race.championship, race.round, excludedRaceId)
    .first();
  return sameRound !== null;
}

/** Equipaggi della classifica o dei cambi pilota che non esistono o che non partecipano al campionato della gara. */
export async function hasCrewsOutsideChampionship(database: SqlDatabase, race: RaceDraft): Promise<boolean> {
  return hasCrewsOutside(database, race.championship, [
    ...race.results.map((result) => result.crewId),
    ...race.driverSwaps.map((driverSwap) => driverSwap.crewId),
  ]);
}

/** Qualcuno degli equipaggi indicati non esiste o non partecipa al campionato? */
export async function hasCrewsOutside(database: SqlDatabase, championship: string, requestedCrewIds: readonly number[]): Promise<boolean> {
  const crewIds = [...new Set(requestedCrewIds)];
  if (crewIds.length === 0) return false;
  const row = await database
    .prepare('SELECT COUNT(*) AS validCount FROM crews WHERE id IN (SELECT value FROM json_each(?)) AND championship = ?')
    .bind(JSON.stringify(crewIds), championship)
    .first<{ validCount: number }>();
  return (row?.validCount ?? 0) !== crewIds.length;
}

/** Gara e classifica in un'unica transazione; results = classifica con la vettura già decisa per ogni riga. */
export async function insertRace(
  database: SqlDatabase,
  race: RaceDraft,
  results: readonly SavedRaceResult[],
  createdByDiscordId: string,
): Promise<SavedRace> {
  const [insertedRace] = await database.batch<{ id: number }>([
    database
      .prepare(
        `INSERT INTO races (name, championship, duration, total_laps, round, track_id, is_track_reversed, race_date, start_time, end_date, end_time,
           created_by_discord_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      )
      .bind(
        race.name,
        race.championship,
        race.duration,
        race.totalLaps,
        race.round,
        race.trackId,
        race.isTrackReversed ? 1 : 0,
        race.raceDate,
        race.startTime,
        race.endDate,
        race.endTime,
        createdByDiscordId,
      ),
    // L'id della gara appena inserita si ritrova dalla coppia campionato + round, che è unica.
    database
      .prepare(
        `INSERT INTO race_results (race_id, position, crew_id, laps, car_id, gap)
         SELECT (SELECT id FROM races WHERE championship = ? AND round = ?), ${RESULT_COLUMNS_FROM_JSON}
         FROM json_each(?)`,
      )
      .bind(race.championship, race.round, toResultsJson(results)),
    database
      .prepare(
        `INSERT INTO driver_swaps ${DRIVER_SWAP_INSERT_COLUMNS}
         SELECT (SELECT id FROM races WHERE championship = ? AND round = ?), ${DRIVER_SWAP_COLUMNS_FROM_JSON}
         FROM json_each(?)`,
      )
      .bind(race.championship, race.round, toDriverSwapsJson(race.driverSwaps)),
  ]);

  const raceId = insertedRace?.results[0]?.id;
  const savedRace = raceId === undefined ? null : await findRaceById(database, raceId);
  if (!savedRace) throw new Error('Il database non ha restituito la gara inserita.');
  return savedRace;
}

/** Aggiorna la gara e sostituisce la classifica, in un'unica transazione; null se non esiste. */
export async function updateRace(
  database: SqlDatabase,
  raceId: number,
  race: RaceDraft,
  results: readonly SavedRaceResult[],
  /** true (Gestisci ordini di arrivo): i cambi pilota restano quelli salvati, li gestiscono i Commissari. */
  keepDriverSwaps = false,
): Promise<SavedRace | null> {
  await database.batch([
    database
      .prepare(
        `UPDATE races SET name = ?, championship = ?, duration = ?, total_laps = ?, round = ?, track_id = ?, is_track_reversed = ?, race_date = ?,
           start_time = ?, end_date = ?, end_time = ?, updated_at = ${NOW_TIMESTAMP}
         WHERE id = ?`,
      )
      .bind(
        race.name,
        race.championship,
        race.duration,
        race.totalLaps,
        race.round,
        race.trackId,
        race.isTrackReversed ? 1 : 0,
        race.raceDate,
        race.startTime,
        race.endDate,
        race.endTime,
        raceId,
      ),
    database.prepare('DELETE FROM race_results WHERE race_id = ?').bind(raceId),
    database
      .prepare(
        `INSERT INTO race_results (race_id, position, crew_id, laps, car_id, gap)
         SELECT ?, ${RESULT_COLUMNS_FROM_JSON}
         FROM json_each(?)`,
      )
      .bind(raceId, toResultsJson(results)),
    ...(keepDriverSwaps ? [] : driverSwapStatements(database, raceId, race.driverSwaps)),
  ]);
  return findRaceById(database, raceId);
}

const driverSwapStatements = (database: SqlDatabase, raceId: number, driverSwaps: readonly DriverSwapEntry[]) => [
  database.prepare('DELETE FROM driver_swaps WHERE race_id = ?').bind(raceId),
  database
    .prepare(`INSERT INTO driver_swaps ${DRIVER_SWAP_INSERT_COLUMNS} SELECT ?, ${DRIVER_SWAP_COLUMNS_FROM_JSON} FROM json_each(?)`)
    .bind(raceId, toDriverSwapsJson(driverSwaps)),
];

/** Sostituisce solo i cambi pilota della gara (Gestisci cambi pilota dei Commissari Sportivi). */
export async function replaceDriverSwaps(database: SqlDatabase, raceId: number, driverSwaps: readonly DriverSwapEntry[]): Promise<SavedRace | null> {
  await database.batch([
    database.prepare(`UPDATE races SET updated_at = ${NOW_TIMESTAMP} WHERE id = ?`).bind(raceId),
    ...driverSwapStatements(database, raceId, driverSwaps),
  ]);
  return findRaceById(database, raceId);
}

/** Elimina le gare indicate con classifiche, penalità e cambi pilota, tutto insieme; restituisce quante gare sono state eliminate. */
export async function deleteRaces(database: SqlDatabase, raceIds: readonly number[]): Promise<number> {
  const idsJson = JSON.stringify(raceIds);
  const [, , , , deletedRaces] = await database.batch<{ id: number }>([
    database.prepare('DELETE FROM race_results WHERE race_id IN (SELECT value FROM json_each(?))').bind(idsJson),
    database.prepare('DELETE FROM driver_swaps WHERE race_id IN (SELECT value FROM json_each(?))').bind(idsJson),
    database
      .prepare('DELETE FROM penalty_crews WHERE penalty_id IN (SELECT id FROM penalties WHERE race_id IN (SELECT value FROM json_each(?)))')
      .bind(idsJson),
    database.prepare('DELETE FROM penalties WHERE race_id IN (SELECT value FROM json_each(?))').bind(idsJson),
    database.prepare('DELETE FROM races WHERE id IN (SELECT value FROM json_each(?)) RETURNING id').bind(idsJson),
  ]);
  return deletedRaces?.results.length ?? 0;
}
