import type { Car } from '../../../shared/carRules';
import type { SqlDatabase } from '../database/sqlDatabase';

interface CarRow {
  readonly id: number;
  readonly manufacturer: string;
  readonly model: string | null;
  readonly horsepower: number | null;
  readonly weight_kg: number | null;
  readonly limiter: number | null;
  readonly ballast_kg: number | null;
}

const toCar = (row: CarRow): Car => ({
  id: row.id,
  manufacturer: row.manufacturer,
  model: row.model,
  horsepower: row.horsepower,
  weightKg: row.weight_kg,
  limiter: row.limiter,
  ballastKg: row.ballast_kg,
});

/** Tutte le auto in ordine alfabetico di costruttore e modello. */
export async function listCars(database: SqlDatabase): Promise<Car[]> {
  const { results } = await database
    .prepare(
      `SELECT id, manufacturer, model, horsepower, weight_kg, limiter, ballast_kg FROM cars
       ORDER BY manufacturer COLLATE NOCASE, IFNULL(model, '') COLLATE NOCASE`,
    )
    .all<CarRow>();
  return results.map(toCar);
}

export async function carExists(database: SqlDatabase, carId: number): Promise<boolean> {
  return (await database.prepare('SELECT id FROM cars WHERE id = ?').bind(carId).first()) !== null;
}
