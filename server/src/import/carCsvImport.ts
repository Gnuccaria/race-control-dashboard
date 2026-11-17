import {
  type Car,
  CAR_MANUFACTURER_MAX_LENGTH,
  CAR_MODEL_MAX_LENGTH,
  type CarDraft,
  toCarKey,
  validateCarDraft,
} from '../../../shared/carRules';
import { type CatalogSyncPlan, planCatalogSync } from './catalogSync';
import { findColumns, findExtraCellsProblem, type ImportProblem, parseCsv, readCell, toSqlNumber, toSqlText } from './csv';

/**
 * Sostituzione della tabella delle auto con un file CSV (colonne Costruttore, Modello, PS, kg,
 * Limitatore, Zavorra). Puro: lo script scripts/importCars.ts legge il database e scrive l'SQL.
 * I campionati in cui un'auto è ammessa si decidono nell'app (Gestione campionati) e non cambiano con l'importazione;
 * le auto nuove non sono ammesse in nessun campionato finché non le si aggiunge.
 */

/** Auto già nel database, con quante volte è usata (equipaggi + righe di ordini di arrivo). */
export interface ExistingCar extends Car {
  readonly usageCount: number;
}

export interface CarImportPlan {
  readonly problems: readonly ImportProblem[];
  /** null se il file ha problemi: in quel caso non si scrive nulla. */
  readonly sync: CatalogSyncPlan<CarDraft, ExistingCar> | null;
}

const HEADER_ALIASES = {
  manufacturer: ['costruttore', 'marca', 'casa', 'produttore', 'manufacturer', 'brand', 'make'],
  model: ['modello', 'model', 'vettura', 'auto'],
  horsepower: ['ps', 'cv', 'hp', 'bhp', 'potenza', 'horsepower', 'power', 'horsepowerps'],
  weightKg: ['kg', 'peso', 'pesokg', 'weight', 'weightkg'],
  limiter: ['limitatore', 'limiter', 'restrictor', 'restrittore', 'powerlimiter'],
  ballastKg: ['zavorra', 'zavorrakg', 'ballast', 'ballastkg'],
} as const;
type CarColumn = keyof typeof HEADER_ALIASES;
const DEFAULT_COLUMNS: Record<CarColumn, number> = { manufacturer: 0, model: 1, horsepower: 2, weightKg: 3, limiter: 4, ballastKg: 5 };
const COLUMN_LABELS: Record<Exclude<CarColumn, 'manufacturer' | 'model'>, string> = {
  horsepower: 'PS (intero da 1 a 9999)',
  weightKg: 'kg (intero da 1 a 99999)',
  limiter: 'limitatore (numero da 0 a 9999, ammessi i decimali)',
  ballastKg: 'zavorra (intero da 0 a 9999)',
};

/**
 * "1.250" (migliaia all'italiana) → 1250; "95,5" o "95.5" → 95.5; "20%" → 20; vuoto → null.
 * Qualsiasi altra cosa → NaN, che la convalida rifiuta.
 */
export function parseCsvNumber(rawValue: string): number | null {
  const text = rawValue.replace(/\s/g, '').replace(/%$/, '');
  if (text === '') return null;
  const normalized = /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replaceAll('.', '') : text.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

const NAME_MESSAGES = {
  required: 'costruttore mancante',
  'invalid-characters': 'contiene caratteri non ammessi (lettere, numeri, spazi e . \' & ( ) / + -)',
} as const;

export function planCarImport(csvText: string, existingCars: readonly ExistingCar[]): CarImportPlan {
  const rows = parseCsv(csvText);
  const [firstRow] = rows;
  if (!firstRow) return { problems: [{ line: 1, message: 'il file è vuoto' }], sync: null };

  const headerColumns = findColumns(firstRow.cells, HEADER_ALIASES, ['manufacturer']);
  const columns = headerColumns ?? DEFAULT_COLUMNS;
  const dataRows = headerColumns ? rows.slice(1) : rows;
  if (dataRows.length === 0) return { problems: [{ line: 1, message: 'nel file non ci sono auto' }], sync: null };

  const drafts: CarDraft[] = [];
  const problems: ImportProblem[] = [];
  const lineByKey = new Map<string, number>();

  for (const { line, cells } of dataRows) {
    const raw = Object.fromEntries(
      (Object.keys(columns) as CarColumn[]).map((column) => [column, readCell(cells, columns[column])]),
    ) as Record<CarColumn, string>;
    const rowLabel = [raw.manufacturer, raw.model].filter(Boolean).join(' ') || 'auto senza nome';
    const extraCellsProblem = headerColumns && findExtraCellsProblem(cells, firstRow.cells.length);
    if (extraCellsProblem) {
      problems.push({ line, message: `${rowLabel}: ${extraCellsProblem}` });
      continue;
    }

    const validation = validateCarDraft({
      manufacturer: raw.manufacturer,
      model: raw.model,
      horsepower: parseCsvNumber(raw.horsepower),
      weightKg: parseCsvNumber(raw.weightKg),
      limiter: parseCsvNumber(raw.limiter),
      ballastKg: parseCsvNumber(raw.ballastKg),
    });

    if (!validation.isValid) {
      const { issues } = validation;
      const reasons = [
        issues.manufacturer &&
          (issues.manufacturer === 'too-long'
            ? `il costruttore supera i ${CAR_MANUFACTURER_MAX_LENGTH} caratteri`
            : issues.manufacturer === 'required'
              ? NAME_MESSAGES.required
              : `il costruttore ${NAME_MESSAGES['invalid-characters']}`),
        issues.model &&
          (issues.model === 'too-long' ? `il modello supera i ${CAR_MODEL_MAX_LENGTH} caratteri` : `il modello ${NAME_MESSAGES['invalid-characters']}`),
        ...(['horsepower', 'weightKg', 'limiter', 'ballastKg'] as const)
          .filter((field) => issues[field])
          .map((field) => `valore "${raw[field]}" non valido per ${COLUMN_LABELS[field]}, oppure vuoto`),
      ].filter(Boolean);
      problems.push({ line, message: `${rowLabel}: ${reasons.join('; ')}` });
      continue;
    }

    const key = toCarKey(validation.car);
    const previousLine = lineByKey.get(key);
    if (previousLine !== undefined) {
      problems.push({ line, message: `${rowLabel}: auto già presente alla riga ${previousLine}` });
      continue;
    }
    lineByKey.set(key, line);
    drafts.push(validation.car);
  }

  if (problems.length > 0) return { problems, sync: null };

  const sync = planCatalogSync(drafts, existingCars, toCarKey, toCarKey, (existing, unmatchedDrafts) => {
    // Le auto inserite finora hanno solo il costruttore ("Ferrari"): se il file ha un solo modello
    // di quel costruttore ("Ferrari 296 GT3"), è la stessa auto con il nome completo e tiene i suoi equipaggi.
    if (existing.model !== null) return undefined;
    const sameManufacturer = unmatchedDrafts.filter(
      (draft) => draft.manufacturer.toLowerCase() === existing.manufacturer.toLowerCase(),
    );
    return sameManufacturer.length === 1 ? sameManufacturer[0] : undefined;
  });
  return { problems: [], sync };
}

const carValuesSql = (car: CarDraft) =>
  [toSqlText(car.manufacturer), toSqlText(car.model), toSqlNumber(car.horsepower), toSqlNumber(car.weightKg), toSqlNumber(car.limiter), toSqlNumber(car.ballastKg)];

/** Prima le eliminazioni, poi gli aggiornamenti, infine le auto nuove: così i nomi non si scontrano mai. */
export function buildCarSyncSql(sync: CatalogSyncPlan<CarDraft, ExistingCar>): string {
  const statements: string[] = [];
  if (sync.deletes.length > 0) {
    const deletedIds = sync.deletes.map((car) => car.id).join(', ');
    statements.push(`DELETE FROM car_championships WHERE car_id IN (${deletedIds});`, `DELETE FROM cars WHERE id IN (${deletedIds});`);
  }
  for (const { existing, draft } of sync.updates) {
    const [manufacturer, model, horsepower, weightKg, limiter, ballastKg] = carValuesSql(draft);
    statements.push(
      `UPDATE cars SET manufacturer = ${manufacturer}, model = ${model}, horsepower = ${horsepower}, weight_kg = ${weightKg}, limiter = ${limiter}, ballast_kg = ${ballastKg} WHERE id = ${existing.id};`,
    );
  }
  for (const draft of sync.inserts) {
    statements.push(`INSERT INTO cars (manufacturer, model, horsepower, weight_kg, limiter, ballast_kg) VALUES (${carValuesSql(draft).join(', ')});`);
  }
  return statements.join('\n');
}
