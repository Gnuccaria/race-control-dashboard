/**
 * Impostazioni di sessione di un campionato (scheda "Impostazioni di sessione"), condivise tra app e server e usate
 * per il briefing pre-gara. Ricalcano la creazione della stanza di Gran Turismo 7: stesse sezioni, stesso ordine.
 * Ogni impostazione ha il valore per la gara e, quando ha senso, quello per la qualifica.
 *
 * I valori sono codici (es. "grid", "weak"), numeri degli slider o, per le gomme, elenchi di mescole.
 * null in uno slider = l'estrema sinistra: "Nessun limite" (PP, potenza, peso, anni) o "Predefinita" (carburante iniziale).
 */

export const TYRE_COMPOUNDS = ['hard', 'medium', 'soft'] as const;
export type TyreCompound = (typeof TYRE_COMPOUNDS)[number];

export type SessionSettingValue = string | number | null | readonly TyreCompound[];

interface ChoiceSetting {
  readonly kind: 'choice';
  readonly options: readonly string[];
  readonly defaultValue: string;
}

interface RangeSetting {
  readonly kind: 'range';
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** null ammesso, all'estrema sinistra dello slider ("Nessun limite" o "Predefinita"). */
  readonly allowsNull: boolean;
  readonly defaultValue: number | null;
}

/** Mescole: "Gomme e tipi utilizzabili" (almeno una) e "Tipo di gomme richieste" (tra quelle utilizzabili). */
interface CompoundsSetting {
  readonly kind: 'compounds';
  readonly defaultValue: readonly TyreCompound[];
}

export type SessionSettingDefinition = (ChoiceSetting | RangeSetting | CompoundsSetting) & {
  readonly key: string;
  /** false per le voci che in qualifica non hanno senso (soste, tempo per completare la gara, corsia dei box). */
  readonly hasQualifying: boolean;
};

const YES_NO = ['yes', 'no'] as const;
const NO_LIMIT_FORBIDDEN = ['noLimit', 'forbidden'] as const;
const PENALTY = ['off', 'weak', 'severe'] as const;
const RESTRICTION = ['unrestricted', 'required', 'forbidden'] as const;
const CURRENT_YEAR_MAX = 2026;

type Keyed<Key extends string, HasQualifying extends boolean> = SessionSettingDefinition & { readonly key: Key; readonly hasQualifying: HasQualifying };

function choice<const Key extends string>(key: Key, options: readonly string[], defaultValue: string): Keyed<Key, true>;
function choice<const Key extends string>(key: Key, options: readonly string[], defaultValue: string, hasQualifying: false): Keyed<Key, false>;
function choice(key: string, options: readonly string[], defaultValue: string, hasQualifying = true): SessionSettingDefinition {
  return { key, kind: 'choice', options, defaultValue, hasQualifying };
}

interface RangeOptions {
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly allowsNull?: boolean;
  readonly defaultValue: number | null;
}

function range<const Key extends string>(key: Key, options: RangeOptions): Keyed<Key, true>;
function range<const Key extends string>(key: Key, options: RangeOptions, hasQualifying: false): Keyed<Key, false>;
function range(key: string, { min, max, step = 1, allowsNull = false, defaultValue }: RangeOptions, hasQualifying = true): SessionSettingDefinition {
  return { key, kind: 'range', min, max, step, allowsNull, defaultValue, hasQualifying };
}

const compounds = <const Key extends string>(key: Key, defaultValue: readonly TyreCompound[]): Keyed<Key, true> => ({ key, kind: 'compounds', defaultValue, hasQualifying: true });

/** Tutte le impostazioni, nell'ordine del gioco (righe da due, da sinistra a destra). */
export const SESSION_SETTING_DEFINITIONS = [
  // Impostazioni gara
  choice('startType', ['grid', 'rolling', 'gridFalseStart'], 'grid'),
  choice('startingGrid', ['fastestFirst', 'slowestFirst', 'hostSet'], 'fastestFirst'),
  choice('bopNoTuning', YES_NO, 'no'),
  choice('boost', ['off', 'weak', 'strong'], 'off'),
  choice('slipstream', ['off', 'realistic', 'weak', 'strong'], 'weak'),
  choice('visibleDamage', YES_NO, 'yes'),
  choice('mechanicalDamage', ['none', 'light', 'championship', 'realistic'], 'none'),
  range('tyreWear', { min: 0, max: 50, defaultValue: 0 }),
  range('fuelConsumption', { min: 0, max: 50, defaultValue: 0 }),
  range('refuelSpeed', { min: 1, max: 10, defaultValue: 1 }),
  range('initialFuel', { min: 1, max: 100, allowsNull: true, defaultValue: null }),
  choice('offTrackGrip', ['low', 'realistic'], 'low'),
  range('timeToFinish', { min: 10, max: 180, step: 10, defaultValue: 30 }, false),
  range('minPitStops', { min: 0, max: 10, defaultValue: 0 }, false),
  choice('mandatoryTyreChange', YES_NO, 'no', false),
  range('overtakeMultiplier', { min: 1, max: 10, defaultValue: 1 }),
  // Impostazioni regolamento
  choice('category', ['noLimit', 'gr1', 'gr2', 'gr3', 'gr4', 'grB'], 'noLimit'),
  range('ppLimit', { min: 100, max: 1000, step: 10, allowsNull: true, defaultValue: null }),
  range('powerLimit', { min: 50, max: 1000, step: 10, allowsNull: true, defaultValue: null }),
  range('minWeight', { min: 500, max: 2000, step: 10, allowsNull: true, defaultValue: null }),
  choice('usableTyres', ['noLimit', 'comfort', 'sport', 'racing'], 'noLimit'),
  compounds('usableCompounds', TYRE_COMPOUNDS),
  compounds('requiredCompounds', []),
  choice('nitro', RESTRICTION, 'unrestricted'),
  choice('kart', YES_NO, 'no'),
  choice('engineSwap', RESTRICTION, 'unrestricted'),
  choice('tuningParts', ['unrestricted', 'supremeAndBelow'], 'unrestricted'),
  range('yearMin', { min: 1920, max: CURRENT_YEAR_MAX, allowsNull: true, defaultValue: null }),
  range('yearMax', { min: 1920, max: CURRENT_YEAR_MAX, allowsNull: true, defaultValue: null }),
  choice('drivetrain', ['unrestricted', 'ff', 'fr', 'mr', 'rr'], 'unrestricted'),
  choice('aspiration', ['unrestricted', 'naturallyAspirated', 'supercharger', 'turbocharger'], 'unrestricted'),
  // Impostazioni penalità
  choice('shortcutPenalty', PENALTY, 'off'),
  choice('wallCollisionPenalty', PENALTY, 'off'),
  choice('wallCollisionCorrection', YES_NO, 'yes'),
  choice('carCollisionPenalty', PENALTY, 'off'),
  choice('pitLaneCutPenalty', PENALTY, 'off', false),
  choice('ghosting', YES_NO, 'no'),
  choice('flags', YES_NO, 'yes'),
  // Limitazioni opzioni di guida
  choice('countersteerAssist', NO_LIMIT_FORBIDDEN, 'noLimit'),
  choice('stabilityControl', NO_LIMIT_FORBIDDEN, 'noLimit'),
  choice('drivingLine', NO_LIMIT_FORBIDDEN, 'noLimit'),
  choice('tractionControl', NO_LIMIT_FORBIDDEN, 'noLimit'),
  choice('abs', NO_LIMIT_FORBIDDEN, 'noLimit'),
  choice('autoDrive', NO_LIMIT_FORBIDDEN, 'noLimit'),
] as const;

export type SessionSettingKey = (typeof SESSION_SETTING_DEFINITIONS)[number]['key'];

/** "Opzioni impostazioni": nel gioco c'è, qui resta bloccata su "Tutti" e non si salva. */
export const LOCKED_SETTINGS_OPTIONS = 'settingsOptions';
export type SessionSettingSlot = SessionSettingKey | typeof LOCKED_SETTINGS_OPTIONS;

export type SessionSettingSectionId = 'race' | 'regulation' | 'penalties' | 'drivingOptions';

/** Sezioni e caselle, nell'ordine e nella disposizione del gioco (due colonne, riga per riga). */
export const SESSION_SETTING_SECTIONS: readonly { readonly id: SessionSettingSectionId; readonly slots: readonly SessionSettingSlot[] }[] = [
  {
    id: 'race',
    slots: [
      'startType', 'startingGrid', 'bopNoTuning', LOCKED_SETTINGS_OPTIONS, 'boost', 'slipstream', 'visibleDamage', 'mechanicalDamage',
      'tyreWear', 'fuelConsumption', 'refuelSpeed', 'initialFuel', 'offTrackGrip', 'timeToFinish', 'minPitStops', 'mandatoryTyreChange',
      'overtakeMultiplier',
    ],
  },
  {
    id: 'regulation',
    slots: [
      'category', 'ppLimit', 'powerLimit', 'minWeight', 'usableTyres', 'usableCompounds', 'requiredCompounds', 'nitro', 'kart', 'engineSwap',
      'tuningParts', 'yearMin', 'yearMax', 'drivetrain', 'aspiration',
    ],
  },
  {
    id: 'penalties',
    slots: ['shortcutPenalty', 'wallCollisionPenalty', 'wallCollisionCorrection', 'carCollisionPenalty', 'pitLaneCutPenalty', 'ghosting', 'flags'],
  },
  {
    id: 'drivingOptions',
    slots: ['countersteerAssist', 'stabilityControl', 'drivingLine', 'tractionControl', 'abs', 'autoDrive'],
  },
];

export type SessionSettingValues = Readonly<Record<SessionSettingKey, SessionSettingValue>>;

export type QualifyingSettingKey = Extract<(typeof SESSION_SETTING_DEFINITIONS)[number], { readonly hasQualifying: true }>['key'];
export type QualifyingSettingValues = Readonly<Record<QualifyingSettingKey, SessionSettingValue>>;

export interface SessionSettings {
  readonly race: SessionSettingValues;
  readonly qualifying: QualifyingSettingValues;
}

const DEFINITION_BY_KEY = new Map<string, SessionSettingDefinition>(SESSION_SETTING_DEFINITIONS.map((definition) => [definition.key, definition]));

export const sessionSettingDefinition = (key: SessionSettingKey): SessionSettingDefinition => DEFINITION_BY_KEY.get(key) as SessionSettingDefinition;

export const QUALIFYING_SETTING_KEYS = SESSION_SETTING_DEFINITIONS.filter((definition) => definition.hasQualifying).map(
  (definition) => definition.key,
) as QualifyingSettingKey[];

export const hasQualifyingSetting = (key: SessionSettingKey): key is QualifyingSettingKey => sessionSettingDefinition(key).hasQualifying;

/** Le posizioni dello slider: null (se ammesso) poi da min a max con il passo. */
export function rangeStops(definition: RangeSetting): (number | null)[] {
  const stops: (number | null)[] = definition.allowsNull ? [null] : [];
  for (let value = definition.min; value <= definition.max; value += definition.step) stops.push(value);
  return stops;
}

const defaultValues = <Key extends string>(keys: readonly Key[]) =>
  Object.fromEntries(keys.map((key) => [key, DEFINITION_BY_KEY.get(key)?.defaultValue ?? null])) as Readonly<Record<Key, SessionSettingValue>>;

/** Valori iniziali di un campionato nuovo, quelli del gioco (anche per i campionati creati prima delle impostazioni). */
export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  race: defaultValues(SESSION_SETTING_DEFINITIONS.map((definition) => definition.key)) as SessionSettingValues,
  qualifying: defaultValues(QUALIFYING_SETTING_KEYS) as QualifyingSettingValues,
};

/** Valori di una sessione, con quelli della gara per le voci che la qualifica non ha (soste, ecc.). */
export type SessionContext = Readonly<Record<string, SessionSettingValue>>;

/**
 * Le voci che nel gioco si attivano solo in certi casi: rifornimento e carburante iniziale con consumo sopra 0x,
 * mescole con gomme "Da corsa", cambio di mescola obbligato con almeno una sosta. Le altre sono sempre attive.
 */
export function isSessionSettingEnabled(key: SessionSettingKey, values: SessionContext): boolean {
  switch (key) {
    case 'refuelSpeed':
    case 'initialFuel':
      return typeof values.fuelConsumption === 'number' && values.fuelConsumption > 0;
    case 'usableCompounds':
    case 'requiredCompounds':
      return values.usableTyres === 'racing';
    case 'mandatoryTyreChange':
      return typeof values.minPitStops === 'number' && values.minPitStops >= 1;
    default:
      return true;
  }
}

/** I valori della qualifica con, per le voci che non ha, quelli della gara. */
export const qualifyingContext = (settings: Pick<SessionSettings, 'race' | 'qualifying'>): SessionContext => ({ ...settings.race, ...settings.qualifying });

/** Mescole nell'ordine Dure, Medie, Morbide, senza doppioni; null se l'elenco non è valido. */
function readCompounds(rawValue: unknown): TyreCompound[] | null {
  if (!Array.isArray(rawValue) || !rawValue.every((compound) => TYRE_COMPOUNDS.includes(compound as TyreCompound))) return null;
  if (new Set(rawValue).size !== rawValue.length) return null;
  return TYRE_COMPOUNDS.filter((compound) => rawValue.includes(compound));
}

function readValue(definition: SessionSettingDefinition, rawValue: unknown): SessionSettingValue | undefined {
  switch (definition.kind) {
    case 'choice':
      return typeof rawValue === 'string' && definition.options.includes(rawValue) ? rawValue : undefined;
    case 'range':
      if (rawValue === null) return definition.allowsNull ? null : undefined;
      return typeof rawValue === 'number' && Number.isInteger(rawValue) && rawValue >= definition.min && rawValue <= definition.max && (rawValue - definition.min) % definition.step === 0
        ? rawValue
        : undefined;
    case 'compounds':
      return readCompounds(rawValue) ?? undefined;
  }
}

/** Problemi tra voci collegate: almeno una mescola, quelle richieste tra le utilizzabili, anno minimo ≤ massimo. */
function findCrossIssue(values: SessionContext): string | null {
  const usable = values.usableCompounds as readonly TyreCompound[];
  const required = values.requiredCompounds as readonly TyreCompound[];
  if (usable.length === 0) return 'usableCompounds';
  if (!required.every((compound) => usable.includes(compound))) return 'requiredCompounds';
  if (typeof values.yearMin === 'number' && typeof values.yearMax === 'number' && values.yearMin > values.yearMax) return 'yearMax';
  return null;
}

export type SessionSettingsReading =
  | { readonly isValid: true; readonly settings: SessionSettings }
  | { readonly isValid: false; readonly session: 'race' | 'qualifying'; readonly key: string };

/** I valori di una sessione per quelle voci, oppure la prima voce senza un valore ammesso. */
function readSession(rawSession: unknown, keys: readonly SessionSettingKey[]): { readonly values: Record<string, SessionSettingValue> } | { readonly invalidKey: string } {
  const rawValues = typeof rawSession === 'object' && rawSession !== null ? (rawSession as Record<string, unknown>) : {};
  const values: Record<string, SessionSettingValue> = {};
  for (const key of keys) {
    const value = readValue(sessionSettingDefinition(key), rawValues[key]);
    if (value === undefined) return { invalidKey: key };
    values[key] = value;
  }
  return { values };
}

/** Convalida impostazioni di origine sconosciuta: tutte le voci presenti e con un valore ammesso. */
export function readSessionSettings(input: unknown): SessionSettingsReading {
  const candidate = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const race = readSession(candidate.race, SESSION_SETTING_DEFINITIONS.map((definition) => definition.key));
  if ('invalidKey' in race) return { isValid: false, session: 'race', key: race.invalidKey };
  const raceIssue = findCrossIssue(race.values);
  if (raceIssue) return { isValid: false, session: 'race', key: raceIssue };
  const qualifying = readSession(candidate.qualifying, QUALIFYING_SETTING_KEYS);
  if ('invalidKey' in qualifying) return { isValid: false, session: 'qualifying', key: qualifying.invalidKey };
  const qualifyingIssue = findCrossIssue({ ...race.values, ...qualifying.values });
  if (qualifyingIssue) return { isValid: false, session: 'qualifying', key: qualifyingIssue };
  return { isValid: true, settings: { race: race.values as SessionSettingValues, qualifying: qualifying.values as QualifyingSettingValues } };
}

/** Impostazioni salvate (JSON dal database): se mancano o non sono più valide, quelle iniziali. */
export function parseStoredSessionSettings(json: string | null): SessionSettings {
  if (json === null) return DEFAULT_SESSION_SETTINGS;
  try {
    const reading = readSessionSettings(JSON.parse(json));
    return reading.isValid ? reading.settings : DEFAULT_SESSION_SETTINGS;
  } catch {
    return DEFAULT_SESSION_SETTINGS;
  }
}
