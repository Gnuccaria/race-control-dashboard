import {
  checkDriverSwap,
  type DriverSwapCheck,
  type DriverSwapEntry,
  type DriverSwapTotal,
  formatRaceTimestamp,
  parseRaceTimestamp,
  type SavedDriverSwap,
  totalDriverSwapPenalties,
} from '@shared/driverSwapRules';

/** Una riga di un cambio pilota così com'è a schermo. */
export interface DriverSwapRowValues {
  /** Pit In: fine dello stint (vettura ferma in piazzola). */
  readonly pitInText: string;
  /** Pit Out: inizio dello stint successivo (pit stop effettuato). */
  readonly pitOutText: string;
  readonly isCancelled: boolean;
  readonly notes: string;
}

export const EMPTY_DRIVER_SWAP_ROW: DriverSwapRowValues = { pitInText: '', pitOutText: '', isCancelled: false, notes: '' };

/**
 * Scheda "Cambi pilota": rowsBySwap[0] = cambio fra stint 1 e 2, e così via; per id dell'equipaggio.
 * Le righe esistono solo per gli equipaggi del campionato della gara (cambiando campionato si azzerano).
 */
export interface DriverSwapValues {
  readonly rowsBySwap: readonly Readonly<Record<number, DriverSwapRowValues>>[];
}

export const EMPTY_DRIVER_SWAP_VALUES: DriverSwapValues = { rowsBySwap: [] };

export const getDriverSwapRow = (values: DriverSwapValues, swapIndex: number, crewId: number): DriverSwapRowValues =>
  values.rowsBySwap[swapIndex]?.[crewId] ?? EMPTY_DRIVER_SWAP_ROW;

/** Righe salvate → valori a schermo, con i tempi in HH:MM:SS.DDD. */
export function toDriverSwapValues(driverSwaps: readonly SavedDriverSwap[]): DriverSwapValues {
  const rowsBySwap: Record<number, DriverSwapRowValues>[] = [];
  for (const { swap, crewId, pitInMs, pitOutMs, isCancelled, notes } of driverSwaps) {
    const swapRows = (rowsBySwap[swap - 1] ??= {});
    swapRows[crewId] = {
      pitInText: pitInMs === null ? '' : formatRaceTimestamp(pitInMs),
      pitOutText: pitOutMs === null ? '' : formatRaceTimestamp(pitOutMs),
      isCancelled,
      notes,
    };
  }
  return { rowsBySwap: Array.from({ length: rowsBySwap.length }, (_unused, index) => rowsBySwap[index] ?? {}) };
}

/** Tempo non valido = cella da correggere; nel calcolo conta come mancante. */
const readTimestamp = (timestampText: string) => {
  const milliseconds = parseRaceTimestamp(timestampText);
  return { milliseconds: milliseconds === null || Number.isNaN(milliseconds) ? null : milliseconds, isInvalid: Number.isNaN(milliseconds) };
};

const isRowFilled = (row: DriverSwapRowValues) =>
  row.pitInText.trim() !== '' || row.pitOutText.trim() !== '' || row.isCancelled || row.notes.trim() !== '';

export const invalidCellKey = (swapIndex: number, crewId: number, column: 'pitIn' | 'pitOut') => `${swapIndex}:${crewId}:${column}`;

export interface DriverSwapSheet {
  /** Per ogni cambio: esito di ogni equipaggio. */
  readonly checksBySwap: readonly ReadonlyMap<number, DriverSwapCheck>[];
  /** Celle con un tempo non interpretabile, come "cambio:equipaggio:pitIn|pitOut". */
  readonly invalidCells: ReadonlySet<string>;
  /** Cambi (indice da 0) con almeno un tempo non valido. */
  readonly swapsWithErrors: ReadonlySet<number>;
  /** Somma per vettura delle penalità non annullate. */
  readonly totals: readonly DriverSwapTotal[];
  /** Righe compilate da salvare con la gara. */
  readonly entries: readonly DriverSwapEntry[];
  readonly hasErrors: boolean;
}

/** Calcolo di tutta la scheda, come il foglio "Driver Swap Checker", per gli equipaggi indicati. */
export function computeDriverSwapSheet(values: DriverSwapValues, crewIds: readonly number[], swapCount: number): DriverSwapSheet {
  const invalidCells = new Set<string>();
  const swapsWithErrors = new Set<number>();
  const entries: DriverSwapEntry[] = [];

  const checksBySwap = Array.from({ length: swapCount }, (_unused, swapIndex) => {
    const rows = crewIds.map((crewId) => {
      const row = getDriverSwapRow(values, swapIndex, crewId);
      const pitIn = readTimestamp(row.pitInText);
      const pitOut = readTimestamp(row.pitOutText);
      if (pitIn.isInvalid) invalidCells.add(invalidCellKey(swapIndex, crewId, 'pitIn'));
      if (pitOut.isInvalid) invalidCells.add(invalidCellKey(swapIndex, crewId, 'pitOut'));
      if (pitIn.isInvalid || pitOut.isInvalid) swapsWithErrors.add(swapIndex);
      const entry = {
        swap: swapIndex + 1,
        crewId,
        pitInMs: pitIn.milliseconds,
        pitOutMs: pitOut.milliseconds,
        isCancelled: row.isCancelled,
        notes: row.notes.trim(),
      };
      if (isRowFilled(row)) entries.push(entry);
      return entry;
    });
    return new Map(checkDriverSwap(rows).map((check) => [check.crewId, check]));
  });

  return {
    checksBySwap,
    invalidCells,
    swapsWithErrors,
    totals: totalDriverSwapPenalties(checksBySwap.flatMap((checks) => [...checks.values()])),
    entries,
    hasErrors: invalidCells.size > 0,
  };
}
