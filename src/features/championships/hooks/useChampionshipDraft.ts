import {
  CHAMPIONSHIP_DURATIONS_MAX,
  type ChampionshipDraft,
  type ChampionshipDurationIssue,
  type ChampionshipNameIssue,
  findChampionshipNameIssue,
  findDurationIssue,
  validateChampionshipDraft,
} from '@shared/championshipRules';
import { useState } from 'react';

/** Una riga delle durate come si scrive: ore e minuti dello stint come testo (solo cifre). */
export interface DurationRow {
  /** Identifica la riga nell'elenco (anche dopo aver tolto quelle sopra). */
  readonly rowId: number;
  readonly hours: string;
  readonly stintMinutes: string;
}

export interface ChampionshipValues {
  readonly name: string;
  readonly durations: readonly DurationRow[];
  readonly carIds: readonly number[];
}

const HOURS_MAX_DIGITS = 2;
const STINT_MAX_DIGITS = 4;
const onlyDigits = (rawValue: string, maxDigits: number) => rawValue.replace(/\D/g, '').slice(0, maxDigits);
const toNumber = (text: string): number | null => (text === '' ? null : Number(text));

const emptyRow = (rowId: number): DurationRow => ({ rowId, hours: '', stintMinutes: '' });

/** Valori iniziali: quelli salvati (dettaglio) oppure un campionato vuoto con una durata da compilare. */
export function toChampionshipValues(saved?: ChampionshipDraft): ChampionshipValues {
  if (!saved) return { name: '', durations: [emptyRow(1)], carIds: [] };
  return {
    name: saved.name,
    durations: saved.durations.map((duration, index) => ({ rowId: index + 1, hours: String(duration.hours), stintMinutes: String(duration.stintMinutes) })),
    carIds: [...saved.carIds],
  };
}

const toDraftInput = (values: ChampionshipValues) => ({
  name: values.name,
  durations: values.durations.map((row) => ({ hours: toNumber(row.hours), stintMinutes: toNumber(row.stintMinutes) })),
  carIds: values.carIds,
});

/** Problema di una riga, solo quando è compilata per intero (mentre si scrive non si disturba). */
export function findRowIssue(row: DurationRow, rows: readonly DurationRow[]): ChampionshipDurationIssue | 'repeated' | null {
  if (row.hours === '' || row.stintMinutes === '') return null;
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
    changeName: (name: string) => {
      setValues((previous) => ({ ...previous, name }));
    },
    changeHours: (rowId: number, rawValue: string) => updateRow(rowId, { hours: onlyDigits(rawValue, HOURS_MAX_DIGITS) }),
    changeStintMinutes: (rowId: number, rawValue: string) => updateRow(rowId, { stintMinutes: onlyDigits(rawValue, STINT_MAX_DIGITS) }),
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
    /** Aggiunge le vetture non ancora presenti, nell'ordine dato. */
    addCars: (carIds: readonly number[]) => {
      setValues((previous) => ({ ...previous, carIds: [...previous.carIds, ...carIds.filter((carId) => !previous.carIds.includes(carId))] }));
    },
    removeCar: (carId: number) => {
      setValues((previous) => ({ ...previous, carIds: previous.carIds.filter((candidate) => candidate !== carId) }));
    },
  };
}

export type ChampionshipDraftState = ReturnType<typeof useChampionshipDraft>;
