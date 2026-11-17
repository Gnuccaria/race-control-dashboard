/** Auto disponibili, salvate sul server (tabella cars) e lette dall'app per i menu delle auto. */
export interface Car {
  readonly id: number;
  readonly manufacturer: string;
  /** null = modello non indicato. */
  readonly model: string | null;
  /** Potenza in PS. */
  readonly horsepower: number | null;
  readonly weightKg: number | null;
  /** Limitatore di potenza (ammessi anche i decimali). */
  readonly limiter: number | null;
  /** Zavorra in kg. */
  readonly ballastKg: number | null;
  /** Campionati in cui l'auto è ammessa (si decide in "Gestisci campionati"), in ordine alfabetico. */
  readonly championships: readonly string[];
}

/** Dati di un'auto da salvare (senza id e campionati, che si decidono nei campionati). */
export type CarDraft = Omit<Car, 'id' | 'championships'>;

export const CAR_MANUFACTURER_MAX_LENGTH = 48;
export const CAR_MODEL_MAX_LENGTH = 64;
/** Limiti larghi, solo per fermare errori di battitura evidenti. */
const CAR_NUMBER_LIMITS = {
  horsepower: { min: 1, max: 9999, isInteger: true },
  weightKg: { min: 1, max: 99999, isInteger: true },
  limiter: { min: 0, max: 9999, isInteger: false },
  ballastKg: { min: 0, max: 9999, isInteger: true },
} as const;
export type CarNumberField = keyof typeof CAR_NUMBER_LIMITS;
export const CAR_NUMBER_FIELDS = Object.keys(CAR_NUMBER_LIMITS) as CarNumberField[];

/** Nomi reali di costruttori e modelli: "Mercedes-AMG", "911 GT3 R (992)", "M4 GT3 Evo", "Aston Martin V8 Vantage". */
const CAR_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} .'’&()/+-]*$/u;

/** "Porsche" o "Porsche 911 GT3 R": come l'auto compare nei menu e nelle tabelle. */
export const formatCarName = (car: Pick<Car, 'manufacturer' | 'model'>): string =>
  car.model ? `${car.manufacturer} ${car.model}` : car.manufacturer;

/** Chiave per riconoscere la stessa auto senza badare a maiuscole (come l'indice unico del database). */
export const toCarKey = (car: Pick<Car, 'manufacturer' | 'model'>): string =>
  `${car.manufacturer.toLowerCase()}|${(car.model ?? '').toLowerCase()}`;

export interface CarDraftIssues {
  readonly manufacturer?: 'required' | 'invalid-characters' | 'too-long';
  readonly model?: 'invalid-characters' | 'too-long';
  readonly horsepower?: 'invalid';
  readonly weightKg?: 'invalid';
  readonly limiter?: 'invalid';
  readonly ballastKg?: 'invalid';
}

export type CarDraftValidation =
  | { readonly isValid: true; readonly car: CarDraft }
  | { readonly isValid: false; readonly issues: CarDraftIssues };

const normalizeName = (value: unknown): string => (typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : '');

function checkName(name: string, maxLength: number): 'invalid-characters' | 'too-long' | undefined {
  if ([...name].length > maxLength) return 'too-long';
  return CAR_NAME_PATTERN.test(name) ? undefined : 'invalid-characters';
}

/** Convalida dati di origine sconosciuta; nome e modello tornano con gli spazi normalizzati. */
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

  const numbers = {} as Record<CarNumberField, number | null>;
  for (const field of CAR_NUMBER_FIELDS) {
    const value = candidate[field];
    const { min, max, isInteger } = CAR_NUMBER_LIMITS[field];
    if (value === undefined || value === null) numbers[field] = null;
    else if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!isInteger || Number.isInteger(value))) {
      numbers[field] = value;
    } else issues[field] = 'invalid';
  }

  if (Object.keys(issues).length > 0) return { isValid: false, issues };
  return { isValid: true, car: { manufacturer, model: model === '' ? null : model, ...numbers } };
}

