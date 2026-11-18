import {
  CHAMPIONSHIP_DURATIONS_MAX,
  type ChampionshipDraft,
  type ChampionshipDurationIssue,
  type ChampionshipNameIssue,
  findChampionshipNameIssue,
  findDurationIssue,
  validateChampionshipDraft,
} from '@shared/championshipRules';
import {
  DEFAULT_SESSION_SETTINGS,
  hasQualifyingSetting,
  QUALIFYING_SETTING_KEYS,
  type SessionSettingKey,
  type SessionSettings,
  type SessionSettingValue,
  type TyreCompound,
} from '@shared/sessionSettingsRules';
import { useState } from 'react';

/** Una riga delle durate come si scrive: ore e minuti dello stint come testo (solo cifre). */
export interface DurationRow {
  /** Identifica la riga nell'elenco (anche dopo aver tolto quelle sopra). */
  readonly rowId: number;
  readonly hours: string;
  readonly stintMinutes: string;
  /** Orario di partenza "HH:MM" (scheda Gestione stint); '' finché non si sceglie. */
  readonly startTime: string;
}

export interface ChampionshipValues {
  readonly name: string;
  readonly durations: readonly DurationRow[];
  readonly carIds: readonly number[];
  readonly sessionSettings: SessionSettings;
  /**
   * Voci della qualifica che seguono ancora la gara: la prima volta che si sceglie il valore della gara, la qualifica
   * lo prende e da lì resta indipendente (anche se la si modifica a mano prima). Tutte in un campionato nuovo, nessuna in uno salvato.
   */
  readonly linkedQualifyingKeys: readonly SessionSettingKey[];
}

const HOURS_MAX_DIGITS = 2;
const STINT_MAX_DIGITS = 4;
const onlyDigits = (rawValue: string, maxDigits: number) => rawValue.replace(/\D/g, '').slice(0, maxDigits);
const toNumber = (text: string): number | null => (text === '' ? null : Number(text));

const emptyRow = (rowId: number): DurationRow => ({ rowId, hours: '', stintMinutes: '', startTime: '' });

/** Valori iniziali: quelli salvati (dettaglio) oppure un campionato vuoto con una durata da compilare. */
export function toChampionshipValues(saved?: ChampionshipDraft): ChampionshipValues {
  if (!saved) return { name: '', durations: [emptyRow(1)], carIds: [], sessionSettings: DEFAULT_SESSION_SETTINGS, linkedQualifyingKeys: QUALIFYING_SETTING_KEYS };
  return {
    name: saved.name,
    durations: saved.durations.map((duration, index) => ({
      rowId: index + 1,
      hours: String(duration.hours),
      stintMinutes: String(duration.stintMinutes),
      startTime: duration.startTime ?? '',
    })),
    carIds: [...saved.carIds],
    sessionSettings: saved.sessionSettings,
    linkedQualifyingKeys: [],
  };
}

const isEmptyRow = (row: DurationRow) => row.hours === '' && row.stintMinutes === '';

/** Togliendo una mescola dalle utilizzabili, sparisce anche dalle richieste della stessa sessione. */
function withSettingValue<Values extends Readonly<Record<string, SessionSettingValue>>>(values: Values, key: SessionSettingKey, value: SessionSettingValue): Values {
  if (key !== 'usableCompounds') return { ...values, [key]: value };
  const usable = value as readonly TyreCompound[];
  return { ...values, usableCompounds: usable, requiredCompounds: (values.requiredCompounds as readonly TyreCompound[]).filter((compound) => usable.includes(compound)) };
}

/** Le righe delle durate lasciate del tutto vuote non contano (es. dopo "Aggiungi una durata" senza compilarla). */
const toDraftInput = (values: ChampionshipValues) => ({
  name: values.name,
  durations: values.durations
    .filter((row) => !isEmptyRow(row))
    .map((row) => ({ hours: toNumber(row.hours), stintMinutes: toNumber(row.stintMinutes), startTime: row.startTime })),
  carIds: values.carIds,
  sessionSettings: values.sessionSettings,
});

/** Problema di una riga: vuota va bene (non conta); compilata a metà manca l'altro valore. */
export function findRowIssue(row: DurationRow, rows: readonly DurationRow[]): ChampionshipDurationIssue | 'repeated' | 'incomplete' | null {
  if (isEmptyRow(row)) return null;
  if (row.hours === '' || row.stintMinutes === '') return 'incomplete';
  const issue = findDurationIssue(Number(row.hours), Number(row.stintMinutes));
  if (issue) return issue;
  const firstWithSameHours = rows.find((candidate) => candidate.hours === row.hours);
  return firstWithSameHours && firstWithSameHours.rowId !== row.rowId ? 'repeated' : null;
}

/** Stato del form di un campionato (Crea campionato e dettaglio), con le stesse regole del server. */
export function useChampionshipDraft(saved?: ChampionshipDraft) {
  const [values, setValues] = useState<ChampionshipValues>(() => toChampionshipValues(saved));
  const validation = validateChampionshipDraft(toDraftInput(values));
  const nameIssue: ChampionshipNameIssue | null = values.name.trim() === '' ? null : findChampionshipNameIssue(values.name);

  const updateRow = (rowId: number, change: Partial<Omit<DurationRow, 'rowId'>>) => {
    setValues((previous) => ({ ...previous, durations: previous.durations.map((row) => (row.rowId === rowId ? { ...row, ...change } : row)) }));
  };

  return {
    values,
    isComplete: validation.isValid,
    validate: () => validation,
    /** Problema del nome da mostrare (non quando è vuoto: lì basta il pulsante disattivato). */
    visibleNameIssue: nameIssue,
    canAddDuration: values.durations.length < CHAMPIONSHIP_DURATIONS_MAX,
    /** Durate compilate e valide: nella scheda Gestione stint, una con l'orario di partenza e gli stint. */
    scheduledRows: values.durations.filter((row) => !isEmptyRow(row) && findRowIssue(row, values.durations) === null),
    /** Problema delle impostazioni di sessione (scheda con il segnale di errore). */
    sessionSettingsIssue: validation.isValid ? null : (validation.issues.sessionSettings ?? null),
    changeName: (name: string) => {
      setValues((previous) => ({ ...previous, name }));
    },
    changeHours: (rowId: number, rawValue: string) => updateRow(rowId, { hours: onlyDigits(rawValue, HOURS_MAX_DIGITS) }),
    changeStintMinutes: (rowId: number, rawValue: string) => updateRow(rowId, { stintMinutes: onlyDigits(rawValue, STINT_MAX_DIGITS) }),
    changeStartTime: (rowId: number, startTime: string) => updateRow(rowId, { startTime }),
    /** Valore della gara; la prima volta la qualifica lo copia (se la voce la prevede e non è già stata scelta). */
    changeRaceSetting: (key: SessionSettingKey, value: SessionSettingValue) => {
      setValues((previous) => {
        const race = withSettingValue(previous.sessionSettings.race, key, value);
        const copiesToQualifying = hasQualifyingSetting(key) && previous.linkedQualifyingKeys.includes(key);
        const qualifying = copiesToQualifying ? withSettingValue(previous.sessionSettings.qualifying, key, value) : previous.sessionSettings.qualifying;
        return {
          ...previous,
          sessionSettings: { race, qualifying },
          linkedQualifyingKeys: previous.linkedQualifyingKeys.filter((linkedKey) => linkedKey !== key),
        };
      });
    },
    changeQualifyingSetting: (key: SessionSettingKey, value: SessionSettingValue) => {
      setValues((previous) => ({
        ...previous,
        sessionSettings: { ...previous.sessionSettings, qualifying: withSettingValue(previous.sessionSettings.qualifying, key, value) },
        linkedQualifyingKeys: previous.linkedQualifyingKeys.filter((linkedKey) => linkedKey !== key),
      }));
    },
    addDuration: () => {
      setValues((previous) => {
        if (previous.durations.length >= CHAMPIONSHIP_DURATIONS_MAX) return previous;
        const nextRowId = Math.max(0, ...previous.durations.map((row) => row.rowId)) + 1;
        return { ...previous, durations: [...previous.durations, emptyRow(nextRowId)] };
      });
    },
    removeDuration: (rowId: number) => {
      setValues((previous) => ({ ...previous, durations: previous.durations.filter((row) => row.rowId !== rowId) }));
    },
    /** Aggiunge le vetture non ancora presenti. */
    addCars: (carIds: readonly number[]) => {
      setValues((previous) => ({ ...previous, carIds: [...previous.carIds, ...carIds.filter((carId) => !previous.carIds.includes(carId))] }));
    },
    removeCar: (carId: number) => {
      setValues((previous) => ({ ...previous, carIds: previous.carIds.filter((candidate) => candidate !== carId) }));
    },
  };
}

export type ChampionshipDraftState = ReturnType<typeof useChampionshipDraft>;
