import type { SqlDatabase } from '../database/sqlDatabase';
import { listPenalties } from '../penalties/penaltyRepository';
import { findRaceSummaryById, listDriverSwaps } from '../races/raceRepository';
import type { RaceReportInput, ReportResultRow } from './raceReportData';

/** Tutto ciò che serve al referto di una gara; null se la gara non esiste. */
export async function loadRaceReportInput(database: SqlDatabase, raceId: number, raceTitle: (round: number, championship: string) => string): Promise<RaceReportInput | null> {
  const race = await findRaceSummaryById(database, raceId);
  if (!race) return null;

  const { results } = await database
    .prepare(
      `SELECT race_results.position, race_results.crew_id AS crewId, crews.number AS crewNumber, crews.name AS crewName,
              cars.manufacturer AS carManufacturer, race_results.laps, race_results.gap AS gapMs
       FROM race_results
       JOIN crews ON crews.id = race_results.crew_id
       LEFT JOIN cars ON cars.id = race_results.car_id
       WHERE race_results.race_id = ?
       ORDER BY race_results.position`,
    )
    .bind(raceId)
    .all<ReportResultRow>();
  const penalties = await listPenalties(database, raceId);
  const { results: penaltyCrews } = await database
    .prepare(
      `SELECT crews.id, crews.number FROM penalty_crews
       JOIN penalties ON penalties.id = penalty_crews.penalty_id
       JOIN crews ON crews.id = penalty_crews.crew_id
       WHERE penalties.race_id = ?
       UNION
       SELECT crews.id, crews.number FROM driver_swaps JOIN crews ON crews.id = driver_swaps.crew_id WHERE driver_swaps.race_id = ?`,
    )
    .bind(raceId, raceId)
    .all<{ id: number; number: number }>();

  return {
    title: race.name ?? raceTitle(race.round, race.championship),
    round: race.round,
    durationHours: race.duration,
    results,
    penalties,
    driverSwaps: await listDriverSwaps(database, raceId),
    crewNumberById: new Map([...results.map((row) => [row.crewId, row.crewNumber] as const), ...penaltyCrews.map((crew) => [crew.id, crew.number] as const)]),
  };
}
