import type { Championship } from '@shared/championshipRules';
import { type CrewChampionship, isCrewInChampionship, type SavedCrew } from '@shared/crewRules';
import type { DriverSwapEntry } from '@shared/driverSwapRules';
import {
  canPositionHaveGap,
  findRepeatedCrewPositions,
  formatGap,
  isIsoDate,
  normalizeRaceName,
  parseGapText,
  parseLaps,
  parseRound,
  RACE_RESULT_POSITIONS,
  type RaceDraft,
  type RaceDraftValidation,
  type RaceResultEntry,
  resolveResultCars,
  type SavedRace,
  type SavedRaceResult,
  validateRaceDraft,
} from '@shared/raceRules';
import { isRaceTime, raceInstants } from '@shared/raceSchedule';
import { type DriverSwapSheet, type DriverSwapValues, EMPTY_DRIVER_SWAP_VALUES, toDriverSwapValues } from './driverSwapDraft';

/** Valori del form di una gara così come sono a schermo ('' / null = non scelto). */
export interface RaceDraftValues {
  readonly name: string;
  readonly championship: CrewChampionship | '';
  /** Ore di gara come testo, tra le durate del campionato ('' = non scelta). */
  readonly duration: string;
  /** Giri totali come testo (facoltativi). */
  readonly totalLapsText: string;
  readonly roundText: string;
  /** Data di inizio (anche futura), ora di inizio, data e ora di fine: in ora italiana. */
  readonly raceDate: string;
  readonly startTime: string;
  readonly endDate: string;
  readonly endTime: string;
  /** Pista scelta nel popup Tracciato (null = non indicata). */
  readonly trackId: number | null;
  readonly isTrackReversed: boolean;
  /** Una casella per posizione (indice 0 = posizione 1). */
  readonly crewIdByPosition: readonly (number | null)[];
  /** Giri completati come testo, una casella per posizione. */
  readonly lapsTextByPosition: readonly string[];
  /** Distacco come testo (minuti:secondi,millesimi), facoltativo, una casella per posizione. */
  readonly gapTextByPosition: readonly string[];
  /** Ordine di arrivo già salvato (vuoto per una gara nuova): le righe invariate tengono la loro vettura. */
  readonly savedResults: readonly SavedRaceResult[];
  /** Scheda "Cambi pilota". */
  readonly driverSwap: DriverSwapValues;
}

export const EMPTY_RACE_VALUES: RaceDraftValues = {
  name: '',
  championship: '',
  duration: '',
  totalLapsText: '',
  roundText: '',
  raceDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  trackId: null,
  isTrackReversed: false,
  crewIdByPosition: Array.from({ length: RACE_RESULT_POSITIONS }, () => null),
  lapsTextByPosition: Array.from({ length: RACE_RESULT_POSITIONS }, () => ''),
  gapTextByPosition: Array.from({ length: RACE_RESULT_POSITIONS }, () => ''),
  savedResults: [],
  driverSwap: EMPTY_DRIVER_SWAP_VALUES,
};

/** decimalSeparator: separatore dei decimali della lingua, per mostrare il distacco salvato (1:05,320 / 1:05.320). */
export function toRaceDraftValues(race: SavedRace, decimalSeparator = ','): RaceDraftValues {
  const crewIdByPosition = [...EMPTY_RACE_VALUES.crewIdByPosition];
  const lapsTextByPosition = [...EMPTY_RACE_VALUES.lapsTextByPosition];
  const gapTextByPosition = [...EMPTY_RACE_VALUES.gapTextByPosition];
  for (const { position, crewId, laps, gapMs } of race.results) {
    crewIdByPosition[position - 1] = crewId;
    lapsTextByPosition[position - 1] = laps === null ? '' : String(laps);
    gapTextByPosition[position - 1] = gapMs === null || !canPositionHaveGap(position) ? '' : formatGap(gapMs, decimalSeparator);
  }
  return {
    name: race.name ?? '',
    championship: race.championship,
    duration: race.duration === null ? '' : String(race.duration),
    totalLapsText: race.totalLaps === null ? '' : String(race.totalLaps),
    roundText: String(race.round),
    raceDate: race.raceDate,
    // Le gare salvate prima degli orari li ricevono vuoti: vanno aggiunti per salvare.
    startTime: race.startTime ?? '',
    endDate: race.endDate ?? '',
    endTime: race.endTime ?? '',
    trackId: race.trackId,
    isTrackReversed: race.isTrackReversed,
    crewIdByPosition,
    lapsTextByPosition,
    gapTextByPosition,
    savedResults: race.results,
    driverSwap: toDriverSwapValues(race.driverSwaps),
  };
}

/**
 * Solo le posizioni occupate: le righe vuote non contano, quindi la classifica può avere meno di 14 righe.
 * Giri mancanti o distacco scritto male → NaN, che la convalida rifiuta.
 */
export function toRaceResults(values: RaceDraftValues): RaceResultEntry[] {
  return values.crewIdByPosition.flatMap((crewId, index) =>
    crewId === null
      ? []
      : [
          {
            position: index + 1,
            crewId,
            laps: parseLaps(values.lapsTextByPosition[index] ?? '') ?? Number.NaN,
            // Il primo non ha distacco: anche un testo rimasto nella sua riga viene ignorato.
            gapMs: canPositionHaveGap(index + 1) ? parseGapText(values.gapTextByPosition[index] ?? '') : null,
          },
        ],
  );
}

/** Posizioni con un equipaggio e un distacco scritto in un formato non valido. */
export const findPositionsWithInvalidGap = (values: RaceDraftValues): number[] =>
  values.crewIdByPosition.flatMap((crewId, index) =>
    crewId !== null && canPositionHaveGap(index + 1) && Number.isNaN(parseGapText(values.gapTextByPosition[index] ?? '')) ? [index + 1] : [],
  );

/** Posizioni con un equipaggio ma senza giri completati. */
export const findPositionsMissingLaps = (values: RaceDraftValues): number[] =>
  values.crewIdByPosition.flatMap((crewId, index) =>
    crewId !== null && parseLaps(values.lapsTextByPosition[index] ?? '') === null ? [index + 1] : [],
  );

/** Equipaggi selezionabili: solo quelli che partecipano al campionato della gara, per numero. */
export const findChampionshipCrews = (crews: readonly SavedCrew[], championship: CrewChampionship | ''): SavedCrew[] =>
  championship === '' ? [] : crews.filter((crew) => isCrewInChampionship(crew, championship)).sort((first, second) => first.number - second.number);

/** Cambiando campionato si tolgono dalla classifica gli equipaggi che non vi partecipano. */
export function keepChampionshipCrews(
  crewIdByPosition: readonly (number | null)[],
  championshipCrews: readonly SavedCrew[],
): (number | null)[] {
  const allowedCrewIds = new Set(championshipCrews.map((crew) => crew.id));
  return crewIdByPosition.map((crewId) => (crewId !== null && allowedCrewIds.has(crewId) ? crewId : null));
}

export interface RaceDraftCheck {
  /** Nome scritto con caratteri non ammessi o troppo lungo. */
  readonly isNameInvalid: boolean;
  /** Il campionato scelto richiede la durata (6 o 12 ore). */
  readonly isDurationRequired: boolean;
  /** Giri totali scritti ma non validi (0 o più di 999). */
  readonly isTotalLapsInvalid: boolean;
  /** Posizioni con più giri completati dei giri totali. */
  readonly positionsOverTotalLaps: readonly number[];
  /** Vettura che verrà salvata in ogni posizione occupata (vedi resolveResultCars). */
  readonly carIdByPosition: ReadonlyMap<number, number | null>;
  /** Posizioni il cui equipaggio dovrebbe portare la sua auto attuale ma non ne ha una. */
  readonly positionsWithoutCar: readonly number[];
  /** Il round scritto non è valido (vuoto non conta come errore visibile). */
  readonly isRoundInvalid: boolean;
  /** Data e ora di fine non successive all'inizio. */
  readonly isEndBeforeStart: boolean;
  /** Posizione ripetuta → posizione dove l'equipaggio compare per la prima volta. */
  readonly repeatedPositions: ReadonlyMap<number, number>;
  /** Posizioni con equipaggio ma senza giri: impediscono il salvataggio. */
  readonly positionsMissingLaps: readonly number[];
  /** Posizioni con un distacco scritto male: impediscono il salvataggio. */
  readonly positionsWithInvalidGap: readonly number[];
  readonly hasInfoErrors: boolean;
  readonly hasResultsErrors: boolean;
  /** Tempi o margine scritti male nella scheda "Cambi pilota". */
  readonly hasDriverSwapErrors: boolean;
  /** Tutto pronto per il salvataggio. */
  readonly isComplete: boolean;
}

/**
 * currentCarIdByCrewId: auto attuale di ogni equipaggio; senza (equipaggi non ancora letti) la vettura non si controlla.
 * driverSwapSheet: calcolo della scheda "Cambi pilota" (vedi computeDriverSwapSheet), se disponibile.
 */
export function checkRaceDraft(
  values: RaceDraftValues,
  currentCarIdByCrewId?: ReadonlyMap<number, number | null>,
  driverSwapSheet?: DriverSwapSheet,
): RaceDraftCheck {
  const round = parseRound(values.roundText);
  const isNameInvalid = normalizeRaceName(values.name) === undefined;
  // La durata è sempre obbligatoria; si sceglie dopo il campionato.
  const isDurationRequired = values.championship !== '';
  const totalLaps = parseLaps(values.totalLapsText);
  const isTotalLapsInvalid = values.totalLapsText !== '' && (totalLaps === null || totalLaps < 1);
  const positionsOverTotalLaps =
    totalLaps === null || isTotalLapsInvalid
      ? []
      : toRaceResults(values)
          .filter((result) => result.laps > totalLaps)
          .map((result) => result.position);
  const { carIdByPosition, positionsWithoutCar } = currentCarIdByCrewId
    ? resolveResultCars(toRaceResults(values), values.savedResults, currentCarIdByCrewId)
    : { carIdByPosition: new Map<number, number | null>(), positionsWithoutCar: [] };
  const isRoundInvalid = values.roundText !== '' && round === null;
  const hasSchedule = isIsoDate(values.raceDate) && isRaceTime(values.startTime) && isIsoDate(values.endDate) && isRaceTime(values.endTime);
  const instants = hasSchedule ? raceInstants(values) : null;
  const isEndBeforeStart = instants !== null && instants.endsAt <= instants.startsAt;
  const repeatedPositions = findRepeatedCrewPositions(toRaceResults(values));
  const positionsMissingLaps = findPositionsMissingLaps(values);
  const positionsWithInvalidGap = findPositionsWithInvalidGap(values);
  const hasDriverSwapErrors = driverSwapSheet?.hasErrors ?? false;
  return {
    isNameInvalid,
    isDurationRequired,
    isTotalLapsInvalid,
    positionsOverTotalLaps,
    carIdByPosition,
    positionsWithoutCar,
    isRoundInvalid,
    isEndBeforeStart,
    repeatedPositions,
    positionsMissingLaps,
    positionsWithInvalidGap,
    hasInfoErrors: isNameInvalid || isTotalLapsInvalid || isRoundInvalid || isEndBeforeStart,
    hasResultsErrors:
      repeatedPositions.size > 0 || positionsWithoutCar.length > 0 || positionsOverTotalLaps.length > 0 || positionsWithInvalidGap.length > 0,
    hasDriverSwapErrors,
    isComplete:
      !hasDriverSwapErrors &&
      !isNameInvalid &&
      !isTotalLapsInvalid &&
      positionsOverTotalLaps.length === 0 &&
      values.championship !== '' &&
      (!isDurationRequired || values.duration !== '') &&
      round !== null &&
      hasSchedule &&
      !isEndBeforeStart &&
      repeatedPositions.size === 0 &&
      positionsMissingLaps.length === 0 &&
      positionsWithInvalidGap.length === 0 &&
      positionsWithoutCar.length === 0,
  };
}

/**
 * Stessa convalida del server, con i valori del form e i campionati salvati (durate e cambi pilota).
 * driverSwaps: righe compilate dei cambi pilota (vedi computeDriverSwapSheet).
 */
export const validateRaceValues = (
  values: RaceDraftValues,
  championships: readonly Pick<Championship, 'name' | 'durations'>[],
  driverSwaps: readonly DriverSwapEntry[] = [],
): RaceDraftValidation =>
  validateRaceDraft({
    name: values.name,
    championship: values.championship,
    duration: values.duration === '' ? null : Number(values.duration),
    totalLaps: values.totalLapsText === '' ? null : (parseLaps(values.totalLapsText) ?? Number.NaN),
    round: parseRound(values.roundText),
    trackId: values.trackId,
    isTrackReversed: values.isTrackReversed,
    raceDate: values.raceDate,
    startTime: values.startTime,
    endDate: values.endDate,
    endTime: values.endTime,
    results: toRaceResults(values),
    driverSwaps,
  }, championships);

export type { RaceDraft };
