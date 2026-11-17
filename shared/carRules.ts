/**
 * Vetture, salvate sul server (tabella cars) e lette dall'app per i menu e la tabella "Gestisci vetture".
 * I dati arrivano dall'aggiornamento manuale dell'app (server/src/cars/carSources.ts): dati di serie dal catalogo
 * ufficiale di Gran Turismo 7 (gran-turismo.com) e BoP Midspeed da gt-engine.com. Limitatore e zavorra si calcolano.
 */

/** Gruppi delle vetture in catalogo. */
export const CAR_GROUPS = ['Gr.1', 'Gr.2', 'Gr.3', 'Gr.4'] as const;
export type CarGroup = (typeof CAR_GROUPS)[number];
export const isCarGroup = (value: unknown): value is CarGroup => CAR_GROUPS.some((group) => group === value);

/** Trasmissione (schema di trazione): motore anteriore/centrale/posteriore e ruote motrici. */
export const CAR_DRIVETRAINS = ['FF', 'FR', 'MR', 'RR', '4WD'] as const;
export type CarDrivetrain = (typeof CAR_DRIVETRAINS)[number];
export const isCarDrivetrain = (value: unknown): value is CarDrivetrain => CAR_DRIVETRAINS.some((drivetrain) => drivetrain === value);

export interface Car {
  readonly id: number;
  readonly manufacturer: string;
  /** null = modello non indicato. */
  readonly model: string | null;
  readonly group: CarGroup | null;
  /** Potenza di serie in PS (CV). */
  readonly horsepower: number | null;
  /** Peso di serie in kg. */
  readonly weightKg: number | null;
  readonly drivetrain: CarDrivetrain | null;
  /** Potenza e peso con il BoP delle piste a velocità media (Midspeed). */
  readonly bopHorsepower: number | null;
  readonly bopWeightKg: number | null;
  /** % Limitatore: potenza BoP / potenza di serie × 100, arrotondata all'unità (computeLimiterPercent). */
  readonly limiter: number | null;
  /** Zavorra in kg: peso BoP − peso di serie, arrotondata all'unità; negativa se il BoP toglie peso (computeBallastKg). */
  readonly ballastKg: number | null;
  /** Campionati in cui l'auto è ammessa (si decide in "Gestisci campionati"), in ordine alfabetico. */
  readonly championships: readonly string[];
}

/** Dati di un'auto da salvare (senza id e campionati, che si decidono nei campionati). */
export type CarDraft = Omit<Car, 'id' | 'championships'>;

export const CAR_MANUFACTURER_MAX_LENGTH = 48;
export const CAR_MODEL_MAX_LENGTH = 64;
/** Limiti larghi, solo per fermare dati evidentemente sbagliati. */
const CAR_NUMBER_LIMITS = {
  horsepower: { min: 1, max: 9999 },
  weightKg: { min: 1, max: 99999 },
  bopHorsepower: { min: 1, max: 9999 },
  bopWeightKg: { min: 1, max: 99999 },
} as const;
type CarNumberField = keyof typeof CAR_NUMBER_LIMITS;
const CAR_NUMBER_FIELDS = Object.keys(CAR_NUMBER_LIMITS) as CarNumberField[];

/** % Limitatore: 461 PS con il BoP su 536 di serie → 86. Senza uno dei due valori, null. */
export const computeLimiterPercent = (horsepower: number | null, bopHorsepower: number | null): number | null =>
  horsepower && bopHorsepower ? Math.round((bopHorsepower / horsepower) * 100) : null;

/** Zavorra: 1.230 kg con il BoP e 1.220 di serie → +10. Senza uno dei due valori, null. */
export const computeBallastKg = (weightKg: number | null, bopWeightKg: number | null): number | null =>
  weightKg && bopWeightKg ? Math.round(bopWeightKg - weightKg) : null;

/** Nomi reali di costruttori e modelli: "Mercedes-AMG", "911 GT3 R (992) '22", "Huracán GT3 '15", "Gr.3". */
const CAR_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .,'’&()/+!:-]*$/u;

/** "Porsche" o "Porsche 911 GT3 R": come l'auto compare nei menu e nelle tabelle. */
export const formatCarName = (car: Pick<Car, 'manufacturer' | 'model'>): string =>
  car.model ? `${car.manufacturer} ${car.model}` : car.manufacturer;

/** Chiave per riconoscere la stessa auto senza badare a maiuscole (come l'indice unico del database). */
export const toCarKey = (car: Pick<Car, 'manufacturer' | 'model'>): string =>
  `${car.manufacturer.toLowerCase()}|${(car.model ?? '').toLowerCase()}`;

export interface CarDraftIssues {
  readonly manufacturer?: 'required' | 'invalid-characters' | 'too-long';
  readonly model?: 'invalid-characters' | 'too-long';
  readonly group?: 'invalid';
  readonly drivetrain?: 'invalid';
  readonly horsepower?: 'invalid';
  readonly weightKg?: 'invalid';
  readonly bopHorsepower?: 'invalid';
  readonly bopWeightKg?: 'invalid';
}

export type CarDraftValidation =
  | { readonly isValid: true; readonly car: CarDraft }
  | { readonly isValid: false; readonly issues: CarDraftIssues };

const normalizeName = (value: unknown): string => (typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : '');

function checkName(name: string, maxLength: number): 'invalid-characters' | 'too-long' | undefined {
  if ([...name].length > maxLength) return 'too-long';
  return CAR_NAME_PATTERN.test(name) ? undefined : 'invalid-characters';
}

/**
 * Convalida dati di origine sconosciuta; nome e modello tornano con gli spazi normalizzati.
 * Limitatore e zavorra non si leggono dall'input: si calcolano da potenza e peso (di serie e BoP).
 */
export function validateCarDraft(input: unknown): CarDraftValidation {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const manufacturer = normalizeName(candidate.manufacturer);
  const model = normalizeName(candidate.model);
  const issues: { -readonly [Field in keyof CarDraftIssues]: CarDraftIssues[Field] } = {};

  if (manufacturer === '') issues.manufacturer = 'required';
  else {
    const manufacturerIssue = checkName(manufacturer, CAR_MANUFACTURER_MAX_LENGTH);
    if (manufacturerIssue) issues.manufacturer = manufacturerIssue;
  }
  if (model !== '') {
    const modelIssue = checkName(model, CAR_MODEL_MAX_LENGTH);
    if (modelIssue) issues.model = modelIssue;
  }
  const isMissing = (value: unknown) => value === undefined || value === null;
  if (!isMissing(candidate.group) && !isCarGroup(candidate.group)) issues.group = 'invalid';
  if (!isMissing(candidate.drivetrain) && !isCarDrivetrain(candidate.drivetrain)) issues.drivetrain = 'invalid';

  const numbers = {} as Record<CarNumberField, number | null>;
  for (const field of CAR_NUMBER_FIELDS) {
    const value = candidate[field];
    const { min, max } = CAR_NUMBER_LIMITS[field];
    if (isMissing(value)) numbers[field] = null;
    else if (typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max) numbers[field] = value;
    else issues[field] = 'invalid';
  }

  if (Object.keys(issues).length > 0) return { isValid: false, issues };
  return {
    isValid: true,
    car: {
      manufacturer,
      model: model === '' ? null : model,
      group: isCarGroup(candidate.group) ? candidate.group : null,
      drivetrain: isCarDrivetrain(candidate.drivetrain) ? candidate.drivetrain : null,
      ...numbers,
      limiter: computeLimiterPercent(numbers.horsepower, numbers.bopHorsepower),
      ballastKg: computeBallastKg(numbers.weightKg, numbers.bopWeightKg),
    },
  };
}

/* ---------- Aggiornamento dai siti: anteprima e abbinamenti ---------- */

/** Un'auto letta da gt-engine.com (BoP Midspeed), riconosciuta da gruppo, costruttore e modello. */
export interface BopSourceCar {
  /** Chiave stabile: "Gr.3|AMG|Mercedes-AMG GT3 '20". */
  readonly key: string;
  readonly group: CarGroup;
  readonly manufacturer: string;
  readonly model: string;
  readonly bopHorsepower: number;
  readonly bopWeightKg: number;
}

/** Abbinamento scelto a mano: auto del catalogo ufficiale (id "car102") → auto di gt-engine (chiave), o nessuna (null). */
export interface CarSourceMatch {
  readonly officialId: string;
  readonly bopKey: string | null;
}

export interface CarRefreshChange {
  readonly name: string;
  /** Campi cambiati, con valore vecchio e nuovo (per l'anteprima). */
  readonly changes: readonly { readonly field: keyof CarDraft; readonly before: string | number | null; readonly after: string | number | null }[];
}

/** Anteprima dell'aggiornamento (POST /cars/refresh): niente è ancora salvato. */
export interface CarRefreshPreview {
  /** Versione del BoP letta da gt-engine (es. "1.72"), se trovata. */
  readonly bopVersion: string | null;
  /** Le vetture come saranno salvate, per gruppo e nome. */
  readonly cars: readonly (CarDraft & { readonly officialId: string; readonly bopKey: string | null })[];
  readonly inserted: readonly string[];
  readonly updated: readonly CarRefreshChange[];
  readonly deleted: readonly string[];
  /** Auto non più nei siti ma usate da equipaggi o gare: restano. */
  readonly kept: readonly string[];
  /** Auto del catalogo ufficiale senza BoP trovato (da abbinare a mano, se c'è). */
  readonly unmatchedOfficial: readonly { readonly officialId: string; readonly group: CarGroup; readonly name: string }[];
  /** Auto di gt-engine non abbinate a nessuna del catalogo ufficiale (le scelte possibili). */
  readonly unmatchedBop: readonly { readonly key: string; readonly group: CarGroup; readonly name: string }[];
}

/** Abbinamenti dal corpo della richiesta; null se non validi. */
export function readCarSourceMatches(rawValue: unknown): CarSourceMatch[] | null {
  if (rawValue === undefined) return [];
  if (!Array.isArray(rawValue) || rawValue.length > 500) return null;
  const matches: CarSourceMatch[] = [];
  for (const rawMatch of rawValue as unknown[]) {
    const { officialId, bopKey } = (typeof rawMatch === 'object' && rawMatch !== null ? rawMatch : {}) as Record<string, unknown>;
    if (typeof officialId !== 'string' || !/^car\d{1,6}$/.test(officialId)) return null;
    if (bopKey !== null && (typeof bopKey !== 'string' || bopKey.length === 0 || bopKey.length > 200)) return null;
    if (matches.some((match) => match.officialId === officialId)) return null;
    matches.push({ officialId, bopKey });
  }
  return matches;
}
