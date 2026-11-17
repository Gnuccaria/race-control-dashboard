import { championshipDurations, driverSwapCountOf, onlyDurationOf } from '@shared/championshipRules';
import { type CrewChampionship, crewCarIn, type SavedCrew } from '@shared/crewRules';
import { DRIVER_SWAP_NOTES_MAX_LENGTH, normalizeTimestampText, sanitizeTimestampInput } from '@shared/driverSwapRules';
import {
  canPositionHaveGap,
  sanitizeGapInput,
  sanitizeLapsInput,
  sanitizeRoundInput,
} from '@shared/raceRules';
import { useState } from 'react';
import { useChampionships } from '@/features/championships/useChampionships';
import type { TrackChoice } from '@/features/tracks/model/trackSelection';
import {
  checkRaceDraft,
  EMPTY_RACE_VALUES,
  findChampionshipCrews,
  keepChampionshipCrews,
  type RaceDraftValues,
  validateRaceValues,
} from '../model/raceDraft';
import { computeDriverSwapSheet, type DriverSwapRowValues, type DriverSwapValues, getDriverSwapRow } from '../model/driverSwapDraft';

/** Copia della lista con il valore della posizione indicata (1 = prima riga) sostituito. */
const replaceAt = <Value,>(list: readonly Value[], position: number, value: Value): Value[] =>
  list.map((currentValue, index) => (index === position - 1 ? value : currentValue));

/** Riga vuota: nessun equipaggio, nessun giro, nessun distacco. */
const clearPositionValues = (values: RaceDraftValues, position: number): RaceDraftValues => ({
  ...values,
  crewIdByPosition: replaceAt(values.crewIdByPosition, position, null),
  lapsTextByPosition: replaceAt(values.lapsTextByPosition, position, ''),
  gapTextByPosition: replaceAt(values.gapTextByPosition, position, ''),
});

/** Equipaggi che hanno almeno una riga nei cambi pilota (prima che gli equipaggi siano letti dal server). */
const crewIdsWithRows = (driverSwap: DriverSwapValues): number[] =>
  [...new Set(driverSwap.rowsBySwap.flatMap((swapRows) => Object.keys(swapRows).map(Number)))].sort((first, second) => first - second);

/**
 * Stato del form di una gara (nuova o esistente). Il round viene ripulito a ogni battitura
 * (solo cifre); validità ed errori sono derivati durante il render da checkRaceDraft.
 * allCrews (quando letti dal server) servono a sapere quale vettura verrà salvata in ogni riga.
 */
export function useRaceDraft(initialValues: RaceDraftValues = EMPTY_RACE_VALUES, allCrews?: readonly SavedCrew[]) {
  const [values, setValues] = useState<RaceDraftValues>(initialValues);
  // Campionati dal server: durate possibili e, dagli stint, quanti cambi pilota ha la gara.
  const championshipCatalog = useChampionships();
  const { championships } = championshipCatalog;
  // Auto attuale di ogni equipaggio nel campionato della gara (senza campionato, nessuna).
  const currentCarIdByCrewId = allCrews && new Map(allCrews.map((crew) => [crew.id, values.championship === '' ? null : crewCarIn(crew, values.championship)]));
  // Cambi pilota: tante tabelle quanti i cambi della durata (stint − 1), una riga per equipaggio del campionato.
  // Finché gli equipaggi non sono letti si usano quelli che hanno già righe compilate.
  const championshipCrews = allCrews ? findChampionshipCrews(allCrews, values.championship) : [];
  const swapCount = driverSwapCountOf(championships, values.championship, values.duration === '' ? null : Number(values.duration));
  const driverSwapSheet = computeDriverSwapSheet(
    values.driverSwap,
    allCrews ? championshipCrews.map((crew) => crew.id) : crewIdsWithRows(values.driverSwap),
    swapCount,
  );

  return {
    values,
    // Senza i campionati (ancora in lettura) non si sa quante tabelle dei cambi servono: non si salva.
    check: (() => {
      const raceCheck = checkRaceDraft(values, currentCarIdByCrewId, driverSwapSheet);
      return { ...raceCheck, isComplete: raceCheck.isComplete && championships.length > 0 };
    })(),
    championshipCatalog,
    /** Durate del campionato scelto (ore), per il menu Durata. */
    durationOptions: championshipDurations(championships, values.championship).map((duration) => duration.hours),
    championshipCrews,
    swapCount,
    driverSwapSheet,
    changeName: (name: string) => {
      setValues((previousValues) => ({ ...previousValues, name }));
    },
    changeTotalLaps: (rawTotalLaps: string) => {
      setValues((previousValues) => ({ ...previousValues, totalLapsText: sanitizeLapsInput(rawTotalLaps) }));
    },
    changeDuration: (duration: string) => {
      setValues((previousValues) => ({ ...previousValues, duration }));
    },
    /** Cambiando campionato si tolgono dalla classifica gli equipaggi che non vi partecipano. */
    changeChampionship: (championship: CrewChampionship, allCrews: readonly SavedCrew[]) => {
      setValues((previousValues) => {
        const crewIdByPosition = keepChampionshipCrews(previousValues.crewIdByPosition, findChampionshipCrews(allCrews, championship));
        return {
          ...previousValues,
          championship,
          // Resta la durata scelta se il nuovo campionato la prevede; con una sola durata possibile si sceglie da sola.
          duration:
            previousValues.duration !== '' && championshipDurations(championships, championship).some((duration) => String(duration.hours) === previousValues.duration)
              ? previousValues.duration
              : String(onlyDurationOf(championships, championship) ?? ''),
          crewIdByPosition,
          // Le posizioni rimaste senza equipaggio perdono anche giri e distacco.
          lapsTextByPosition: previousValues.lapsTextByPosition.map((lapsText, index) =>
            crewIdByPosition[index] === null ? '' : lapsText,
          ),
          gapTextByPosition: previousValues.gapTextByPosition.map((gapText, index) => (crewIdByPosition[index] === null ? '' : gapText)),
          // I cambi pilota sono per vettura (e numero di cambi) del campionato: con un altro campionato si riparte da zero.
          driverSwap: { rowsBySwap: [] },
        };
      });
    },
    changeRound: (typedValue: string) => {
      setValues((previousValues) => ({ ...previousValues, roundText: sanitizeRoundInput(typedValue) }));
    },
    changeTrack: ({ trackId, isReversed }: TrackChoice) => {
      setValues((previousValues) => ({ ...previousValues, trackId, isTrackReversed: isReversed }));
    },
    changeRaceDate: (raceDate: string) => {
      // La data di fine segue quella di inizio finché non se ne sceglie una diversa (gare che finiscono lo stesso giorno).
      setValues((previousValues) => ({
        ...previousValues,
        raceDate,
        endDate: previousValues.endDate === '' || previousValues.endDate === previousValues.raceDate ? raceDate : previousValues.endDate,
      }));
    },    changeStartTime: (startTime: string) => {
      setValues((previousValues) => ({ ...previousValues, startTime }));
    },
    changeEndDate: (endDate: string) => {
      setValues((previousValues) => ({ ...previousValues, endDate }));
    },
    changeEndTime: (endTime: string) => {
      setValues((previousValues) => ({ ...previousValues, endTime }));
    },

    /** Togliendo l'equipaggio da una posizione si svuotano anche i suoi giri. */
    changeCrewAtPosition: (position: number, crewId: number | null) => {
      setValues((previousValues) =>
        crewId === null
          ? clearPositionValues(previousValues, position)
          : {
              ...previousValues,
              crewIdByPosition: replaceAt(previousValues.crewIdByPosition, position, crewId),
            },
      );
    },
    /** La X a destra della riga: toglie equipaggio, giri e distacco di quella posizione. */
    clearPosition: (position: number) => {
      setValues((previousValues) => clearPositionValues(previousValues, position));
    },
    /** Cifre, ":" e separatore dei decimali (minuti:secondi,millesimi). */
    changeGapAtPosition: (position: number, typedValue: string) => {
      if (!canPositionHaveGap(position)) return;
      setValues((previousValues) => ({
        ...previousValues,
        gapTextByPosition: replaceAt(previousValues.gapTextByPosition, position, sanitizeGapInput(typedValue)),
      }));
    },
    /** Solo cifre, al massimo tre. */
    changeLapsAtPosition: (position: number, typedValue: string) => {
      setValues((previousValues) => ({
        ...previousValues,
        lapsTextByPosition: previousValues.lapsTextByPosition.map((lapsText, index) =>
          index === position - 1 ? sanitizeLapsInput(typedValue) : lapsText,
        ),
      }));
    },
    /** Una cella di una riga di un cambio pilota (i tempi tengono solo cifre e separatori). */
    changeDriverSwapRow: (swapIndex: number, crewId: number, change: Partial<DriverSwapRowValues>) => {
      setValues((previousValues) => {
        const currentRow = getDriverSwapRow(previousValues.driverSwap, swapIndex, crewId);
        const nextRow: DriverSwapRowValues = {
          ...currentRow,
          ...change,
          pitInText: change.pitInText === undefined ? currentRow.pitInText : sanitizeTimestampInput(change.pitInText),
          pitOutText: change.pitOutText === undefined ? currentRow.pitOutText : sanitizeTimestampInput(change.pitOutText),
          notes: (change.notes ?? currentRow.notes).slice(0, DRIVER_SWAP_NOTES_MAX_LENGTH),
        };
        const rowsBySwap = Array.from(
          { length: Math.max(previousValues.driverSwap.rowsBySwap.length, swapIndex + 1) },
          (_unused, index) => previousValues.driverSwap.rowsBySwap[index] ?? {},
        );
        rowsBySwap[swapIndex] = { ...rowsBySwap[swapIndex], [crewId]: nextRow };
        return { ...previousValues, driverSwap: { ...previousValues.driverSwap, rowsBySwap } };
      });
    },
    /** Uscendo da una casella dei tempi: se il tempo è interpretabile diventa HH:MM:SS.DDD, altrimenti resta (in errore). */
    formatDriverSwapTime: (swapIndex: number, crewId: number, column: 'pitIn' | 'pitOut') => {
      setValues((previousValues) => {
        const row = getDriverSwapRow(previousValues.driverSwap, swapIndex, crewId);
        const field = column === 'pitIn' ? 'pitInText' : 'pitOutText';
        const formattedText = normalizeTimestampText(row[field]);
        if (formattedText === row[field]) return previousValues;
        const rowsBySwap = [...previousValues.driverSwap.rowsBySwap];
        rowsBySwap[swapIndex] = { ...rowsBySwap[swapIndex], [crewId]: { ...row, [field]: formattedText } };
        return { ...previousValues, driverSwap: { rowsBySwap } };
      });
    },
    validate: () => validateRaceValues(values, championships, driverSwapSheet.entries),
  };
}

export type RaceDraftState = ReturnType<typeof useRaceDraft>;
