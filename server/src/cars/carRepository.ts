import type { Car } from '../../../shared/carRules';
import { sortChampionshipNames } from '../../../shared/championshipRules';
import type { SqlDatabase } from '../database/sqlDatabase';

interface CarRow {
  readonly id: number;
  readonly manufacturer: string;
  readonly model: string | null;
  readonly horsepower: number | null;
  readonly weight_kg: number | null;
  readonly limiter: number | null;
  readonly ballast_kg: number | null;
  /** Campionati dell'auto come elenco JSON (car_championships). */
  readonly championships_json: string | null;
}

function readChampionships(json: string | null): string[] {
  try {
    const values = JSON.parse(json ?? '[]') as unknown;
    return Array.isArray(values) ? sortChampionshipNames(values.filter((value): value is string => typeof value === 'string')) : [];
  } catch {
    return [];
  }
}

const toCar = (row: CarRow): Car => ({
  id: row.id,
  manufacturer: row.manufacturer,
  model: row.model,
  horsepower: row.horsepower,
  weightKg: row.weight_kg,
  limiter: row.limiter,
  ballastKg: row.ballast_kg,
  championships: readChampionships(row.championships_json),
});

/** Tutte le auto in ordine alfabetico di costruttore e modello. */
export async function listCars(database: SqlDatabase): Promise<Car[]> {
  const { results } = await database
    .prepare(
      `SELECT id, manufacturer, model, horsepower, weight_kg, limiter, ballast_kg,
         (SELECT json_group_array(championship) FROM car_championships WHERE car_championships.car_id = cars.id) AS championships_json
       FROM cars
       ORDER BY manufacturer COLLATE NOCASE, IFNULL(model, '') COLLATE NOCASE`,
    )
    .all<CarRow>();
  return results.map(toCar);
}

/** L'auto esiste ed è disponibile in quel campionato? */
export async function isCarAvailableIn(database: SqlDatabase, carId: number, championship: string): Promise<boolean> {
  return (await database.prepare('SELECT car_id FROM car_championships WHERE car_id = ? AND championship = ?').bind(carId, championship).first()) !== null;
}

/** Quali di queste auto esistono nel catalogo. */
export async function findExistingCarIds(database: SqlDatabase, carIds: readonly number[]): Promise<number[]> {
  const { results } = await database
    .prepare('SELECT id FROM cars WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(carIds))
    .all<{ id: number }>();
  return results.map((row) => row.id);
}
