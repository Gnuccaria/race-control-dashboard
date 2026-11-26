import {
  type BopSourceCar,
  type CarDraft,
  type CarRefreshChange,
  type CarRefreshPreview,
  type CarSourceMatch,
  formatCarName,
  validateCarDraft,
} from '../../../shared/carRules';
import { readJsonAppSetting, saveJsonAppSetting } from '../database/appSettings';
import type { SqlDatabase } from '../database/sqlDatabase';
import { type CatalogSyncPlan, planCatalogSync } from '../import/catalogSync';
import { compactName, matchBopCar, type OfficialCar } from './carSources';

/** Un'auto come sarà salvata, con le sue origini. */
export type RefreshedCar = CarDraft & { readonly officialId: string; readonly bopKey: string | null; readonly fullName: string };

/** Auto già nel database, con quante volte è usata (campionati degli equipaggi + righe di ordini di arrivo). */
export interface StoredCar extends CarDraft {
  readonly id: number;
  readonly sourceId: string | null;
  readonly usageCount: number;
}

const DRAFT_FIELDS: readonly (keyof CarDraft)[] = ['manufacturer', 'model', 'group', 'horsepower', 'weightKg', 'drivetrain', 'bopHorsepower', 'bopWeightKg', 'limiter', 'ballastKg'];

/**
 * Unisce le due fonti: ogni auto del catalogo ufficiale (Gr.1–Gr.4) prende il BoP Midspeed dell'auto di gt-engine
 * abbinata, scelta a mano (matches, anche "nessuna") o trovata in automatico. Le auto con nome non valido o doppio
 * finiscono in skipped.
 */
export function mergeCarSources(official: readonly OfficialCar[], bop: readonly BopSourceCar[], matches: readonly CarSourceMatch[]) {
  const bopByKey = new Map(bop.map((car) => [car.key, car]));
  const manualByOfficialId = new Map(matches.map((match) => [match.officialId, match.bopKey]));
  // Le auto di gt-engine scelte a mano non si abbinano in automatico ad altre.
  const manuallyUsedKeys = new Set(matches.map((match) => match.bopKey).filter((key) => key !== null));
  const automaticCandidates = bop.filter((car) => !manuallyUsedKeys.has(car.key));

  const cars: RefreshedCar[] = [];
  const skipped: string[] = [];
  const names = new Set<string>();
  const sortedOfficial = [...official].sort((first, second) => first.group.localeCompare(second.group) || first.nameLong.localeCompare(second.nameLong));
  for (const officialCar of sortedOfficial) {
    const manualKey = manualByOfficialId.get(officialCar.id);
    const bopCar = manualKey === undefined ? matchBopCar(officialCar, automaticCandidates) : manualKey === null ? null : (bopByKey.get(manualKey) ?? null);
    const validation = validateCarDraft({
      manufacturer: officialCar.manufacturer,
      model: officialCar.model,
      group: officialCar.group,
      drivetrain: officialCar.drivetrain,
      horsepower: officialCar.horsepower,
      weightKg: officialCar.weightKg,
      bopHorsepower: bopCar?.bopHorsepower ?? null,
      bopWeightKg: bopCar?.bopWeightKg ?? null,
    });
    const nameKey = compactName(`${officialCar.manufacturer} ${officialCar.model}`);
    if (!validation.isValid || names.has(nameKey)) {
      skipped.push(officialCar.nameLong);
      continue;
    }
    names.add(nameKey);
    cars.push({ ...validation.car, officialId: officialCar.id, bopKey: bopCar?.key ?? null, fullName: officialCar.nameLong });
  }

  const usedKeys = new Set(cars.map((car) => car.bopKey).filter((key) => key !== null));
  return {
    cars,
    skipped,
    unmatchedOfficial: cars.filter((car) => car.bopKey === null).map((car) => ({ officialId: car.officialId, group: car.group ?? 'Gr.3', name: formatCarName(car) })),
    unmatchedBop: bop.filter((car) => !usedKeys.has(car.key)).map((car) => ({ key: car.key, group: car.group, name: `${car.manufacturer} ${car.model}` })),
  };
}

/** Chiave del nome come la confronta l'indice unico cars_by_name (costruttore e modello, senza badare a maiuscole). */
const nameIndexKey = (car: Pick<CarDraft, 'manufacturer' | 'model'>) => `${car.manufacturer.toLowerCase()}|${(car.model ?? '').toLowerCase()}`;

/** Suffisso per un'auto salvata che resta (usata) ma il cui nome serve a una vettura dei siti. */
const OLD_CAR_SUFFIX = '(vecchia)';

export type CarRefreshPlan = CatalogSyncPlan<RefreshedCar, StoredCar> & {
  /** Auto che restano ma cambiano modello, perché il loro nome è preso da una vettura dei siti. */
  readonly renamedKept: readonly { readonly existing: StoredCar; readonly model: string }[];
};

/**
 * Confronto con le auto salvate, senza perdere i collegamenti con equipaggi e gare: un'auto si ritrova sempre dall'id
 * del catalogo ufficiale (source_id). Le auto non più nei siti (o salvate senza id) si eliminano, tranne quelle usate,
 * che restano: se il loro nome serve a una vettura dei siti diventano "… (vecchia)", perché due auto non possono avere
 * lo stesso nome.
 */
export function planCarRefresh(cars: readonly RefreshedCar[], stored: readonly StoredCar[]): CarRefreshPlan {
  const plan = planCatalogSync(
    cars,
    stored,
    (car) => `source:${car.officialId}`,
    (car) => (car.sourceId ? `source:${car.sourceId}` : `stored:${car.id}`),
  );

  const takenNames = new Set([...plan.inserts, ...plan.updates.map(({ draft }) => draft)].map(nameIndexKey));
  const renamedKept: { existing: StoredCar; model: string }[] = [];
  for (const existing of plan.kept) {
    if (!takenNames.has(nameIndexKey(existing))) {
      takenNames.add(nameIndexKey(existing));
      continue;
    }
    // Il modello resta entro i 64 caratteri ammessi anche con il suffisso.
    const baseModel = (existing.model ?? '').slice(0, 50).trim();
    let model = `${baseModel} ${OLD_CAR_SUFFIX}`.trim();
    for (let copy = 2; takenNames.has(nameIndexKey({ manufacturer: existing.manufacturer, model })); copy += 1) {
      model = `${baseModel} ${OLD_CAR_SUFFIX.replace(')', ` ${copy})`)}`.trim();
    }
    takenNames.add(nameIndexKey({ manufacturer: existing.manufacturer, model }));
    renamedKept.push({ existing, model });
  }
  return { ...plan, renamedKept };
}

export function describeCarRefresh(
  plan: CarRefreshPlan,
  merged: ReturnType<typeof mergeCarSources>,
  bopVersion: string | null,
): CarRefreshPreview & { readonly skipped: readonly string[] } {
  const updated: CarRefreshChange[] = plan.updates.flatMap(({ existing, draft }) => {
    const changes = DRAFT_FIELDS.filter((field) => existing[field] !== draft[field]).map((field) => ({ field, before: existing[field], after: draft[field] }));
    return changes.length > 0 ? [{ name: formatCarName(draft), changes }] : [];
  });
  return {
    bopVersion,
    // Il nome completo serve solo per ritrovare le auto salvate: nell'anteprima no.
    cars: merged.cars.map(({ officialId, bopKey, manufacturer, model, group, horsepower, weightKg, drivetrain, bopHorsepower, bopWeightKg, limiter, ballastKg }) => ({
      officialId,
      bopKey,
      manufacturer,
      model,
      group,
      horsepower,
      weightKg,
      drivetrain,
      bopHorsepower,
      bopWeightKg,
      limiter,
      ballastKg,
    })),
    inserted: plan.inserts.map(formatCarName),
    updated,
    deleted: plan.deletes.map(formatCarName),
    kept: plan.kept.map((existing) => {
      const renamed = plan.renamedKept.find((entry) => entry.existing.id === existing.id);
      return renamed ? `${formatCarName(existing)} → ${formatCarName({ manufacturer: existing.manufacturer, model: renamed.model })}` : formatCarName(existing);
    }),
    unmatchedOfficial: merged.unmatchedOfficial,
    unmatchedBop: merged.unmatchedBop,
    skipped: merged.skipped,
  };
}

interface StoredCarRow {
  readonly id: number;
  readonly manufacturer: string;
  readonly model: string | null;
  readonly car_group: CarDraft['group'];
  readonly horsepower: number | null;
  readonly weight_kg: number | null;
  readonly drivetrain: CarDraft['drivetrain'];
  readonly bop_horsepower: number | null;
  readonly bop_weight_kg: number | null;
  readonly limiter: number | null;
  readonly ballast_kg: number | null;
  readonly source_id: string | null;
  readonly usage_count: number;
}

export async function listStoredCars(database: SqlDatabase): Promise<StoredCar[]> {
  const { results } = await database
    .prepare(
      `SELECT id, manufacturer, model, car_group, horsepower, weight_kg, drivetrain, bop_horsepower, bop_weight_kg, limiter, ballast_kg, source_id,
         (SELECT COUNT(*) FROM crew_championships WHERE crew_championships.car_id = cars.id)
           + (SELECT COUNT(*) FROM race_results WHERE race_results.car_id = cars.id)
           + (SELECT COUNT(*) FROM race_qualifying WHERE race_qualifying.car_id = cars.id) AS usage_count
       FROM cars`,
    )
    .all<StoredCarRow>();
  return results.map((row) => ({
    id: row.id,
    manufacturer: row.manufacturer,
    model: row.model,
    group: row.car_group,
    horsepower: row.horsepower,
    weightKg: row.weight_kg,
    drivetrain: row.drivetrain,
    bopHorsepower: row.bop_horsepower,
    bopWeightKg: row.bop_weight_kg,
    limiter: row.limiter,
    ballastKg: row.ballast_kg,
    sourceId: row.source_id,
    usageCount: row.usage_count,
  }));
}

/** Abbinamenti scelti a mano negli aggiornamenti precedenti. */
export async function listSavedMatches(database: SqlDatabase): Promise<CarSourceMatch[]> {
  const { results } = await database.prepare('SELECT official_id, bop_key FROM car_source_matches').all<{ official_id: string; bop_key: string | null }>();
  return results.map((row) => ({ officialId: row.official_id, bopKey: row.bop_key }));
}

/** Quelli della richiesta prendono il posto di quelli salvati per la stessa auto. */
export const combineMatches = (saved: readonly CarSourceMatch[], requested: readonly CarSourceMatch[]): CarSourceMatch[] => [
  ...saved.filter((match) => !requested.some((request) => request.officialId === match.officialId)),
  ...requested,
];

const carJson = (car: RefreshedCar, id?: number) => ({
  id,
  manufacturer: car.manufacturer,
  model: car.model,
  group: car.group,
  horsepower: car.horsepower,
  weightKg: car.weightKg,
  drivetrain: car.drivetrain,
  bopHorsepower: car.bopHorsepower,
  bopWeightKg: car.bopWeightKg,
  limiter: car.limiter,
  ballastKg: car.ballastKg,
  sourceId: car.officialId,
});

/** Colonne della tabella cars e campo JSON corrispondente. */
const CAR_COLUMNS = [
  ['manufacturer', 'manufacturer'],
  ['model', 'model'],
  ['car_group', 'group'],
  ['horsepower', 'horsepower'],
  ['weight_kg', 'weightKg'],
  ['drivetrain', 'drivetrain'],
  ['bop_horsepower', 'bopHorsepower'],
  ['bop_weight_kg', 'bopWeightKg'],
  ['limiter', 'limiter'],
  ['ballast_kg', 'ballastKg'],
  ['source_id', 'sourceId'],
] as const;
const COLUMN_NAMES = CAR_COLUMNS.map(([column]) => column).join(', ');
const VALUES_FROM_JSON = CAR_COLUMNS.map(([column, field]) => `json_extract(value, '$.${field}') AS ${column}`).join(', ');
const SET_FROM_CHANGED = CAR_COLUMNS.map(([column]) => `${column} = changed.${column}`).join(', ');

/**
 * Applica il piano in un'unica transazione, con poche istruzioni (i dati passano come JSON: D1 limita il numero di
 * istruzioni e di parametri): eliminazioni, nomi provvisori (così due auto che si scambiano il nome non si
 * scontrano sull'indice unico), auto che restano rinominate "… (vecchia)", aggiornamenti, inserimenti, abbinamenti
 * scelti a mano.
 */
export async function applyCarRefresh(database: SqlDatabase, plan: CarRefreshPlan, requestedMatches: readonly CarSourceMatch[]): Promise<void> {
  const deletedIds = JSON.stringify(plan.deletes.map((car) => car.id));
  const updates = JSON.stringify(plan.updates.map(({ existing, draft }) => carJson(draft, existing.id)));
  const inserts = JSON.stringify(plan.inserts.map((car) => carJson(car)));
  await database.batch([
    database.prepare('DELETE FROM car_championships WHERE car_id IN (SELECT value FROM json_each(?))').bind(deletedIds),
    database.prepare('DELETE FROM cars WHERE id IN (SELECT value FROM json_each(?))').bind(deletedIds),
    database.prepare("UPDATE cars SET manufacturer = '~' || id, source_id = NULL WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?))").bind(updates),
    // Le auto che restano ma lasciano il nome a una vettura dei siti diventano "… (vecchia)".
    database
      .prepare("UPDATE cars SET model = json_extract(renamed.value, '$.model') FROM json_each(?) AS renamed WHERE cars.id = json_extract(renamed.value, '$.id')")
      .bind(JSON.stringify(plan.renamedKept.map(({ existing, model }) => ({ id: existing.id, model })))),
    database
      .prepare(`UPDATE cars SET ${SET_FROM_CHANGED} FROM (SELECT json_extract(value, '$.id') AS id, ${VALUES_FROM_JSON} FROM json_each(?)) AS changed WHERE cars.id = changed.id`)
      .bind(updates),
    database.prepare(`INSERT INTO cars (${COLUMN_NAMES}) SELECT ${VALUES_FROM_JSON} FROM json_each(?)`)
      .bind(inserts),
    database
      .prepare("INSERT OR REPLACE INTO car_source_matches (official_id, bop_key) SELECT json_extract(value, '$.officialId'), json_extract(value, '$.bopKey') FROM json_each(?)")
      .bind(JSON.stringify(requestedMatches)),
  ]);
}

/** Fonti lette dall'ultimo "Aggiorna dati": ricalcolo e salvataggio le riusano senza riscaricare i siti. */
export interface StagedCarSources {
  readonly official: readonly OfficialCar[];
  readonly bop: readonly BopSourceCar[];
  readonly bopVersion: string | null;
}

const STAGED_SOURCES_KEY = 'car_sources';

export const saveStagedSources = (database: SqlDatabase, sources: StagedCarSources, discordUserId: string): Promise<void> =>
  saveJsonAppSetting(database, STAGED_SOURCES_KEY, sources, discordUserId);

/** null se non c'è un "Aggiorna dati" precedente (o il dato salvato non si legge). */
export const readStagedSources = (database: SqlDatabase): Promise<StagedCarSources | null> =>
  readJsonAppSetting<StagedCarSources>(database, STAGED_SOURCES_KEY, (sources) => Array.isArray(sources.official) && Array.isArray(sources.bop));
