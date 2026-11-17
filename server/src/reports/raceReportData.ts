import {
  isArticleNumber,
  isReprimandGridPenalty,
  PENALTY_DECISIONS,
  type PenaltyDecision,
  type PenaltyDocument,
  penaltyGridPositions,
  penaltySeconds,
  REPRIMAND_GRID_POSITIONS,
  type SavedPenaltyCrew,
} from '../../../shared/penaltyRules';
import { DEFAULT_REPORT_LANGUAGE, type ReportLanguage, type ReportTexts, reportTexts } from './reportTexts';

/**
 * Contenuto del referto di gara (sul modello del "Referto di gara – 1000 km di Suzuka"), già pronto da disegnare:
 * classifica finale con distacco dal primo e penalità sommate, poi l'elenco delle penalità. I testi fissi sono nella
 * lingua del sito (reportTexts); violazione e motivazione restano come le ha scritte la Direzione Gara, tranne nel
 * referto in inglese, che usa la loro traduzione salvata quando c'è. Giro veloce e pole position non ci sono ancora.
 * Sul modello del "Referto di gara – 24 Ore di Spa-Francorchamps": il primo della classifica ha nella colonna Leader la
 * durata della gara, e le penalità dei cambi pilota hanno una riga per vettura in fondo alle penalità, con i secondi
 * arrotondati per eccesso (gli stessi sommati in classifica).
 */

export interface ReportResultRow {
  readonly position: number;
  readonly crewId: number;
  readonly crewNumber: number;
  readonly crewName: string;
  /** Costruttore della vettura usata in quella gara (colonna "Vettura"). */
  readonly carManufacturer: string | null;
  readonly laps: number | null;
  readonly gapMs: number | null;
}

export interface ReportPenalty {
  /** Con il numero di ogni reprimenda nel ciclo della vettura (1–3). */
  readonly crews: readonly SavedPenaltyCrew[];
  /** Numero dell'articolo (o testo libero delle penalità salvate prima). */
  readonly violation: string;
  readonly document: PenaltyDocument;
  readonly reason: string;
  /** Motivazione inglese salvata, se c'è. */
  readonly english?: { readonly reason: string } | null;
}

export interface ReportDriverSwapPenalty {
  readonly crewId: number;
  readonly penaltyMs: number | null;
  readonly isCancelled: boolean;
}

export interface RaceReportInput {
  /** Nome della gara, oppure "Round N – Campionato". */
  readonly title: string;
  /** Round della gara: le penalità in griglia valgono nel successivo. */
  readonly round: number;
  /** Durata della gara in ore: colonna Leader del primo ("6:00:00.000"). */
  readonly durationHours?: number | null;
  readonly results: readonly ReportResultRow[];
  readonly penalties: readonly ReportPenalty[];
  readonly driverSwaps: readonly ReportDriverSwapPenalty[];
  /** Numero di ogni equipaggio citato nelle penalità. */
  readonly crewNumberById: ReadonlyMap<number, number>;
  /** Lingua dei testi fissi (italiano se non indicata). */
  readonly language?: ReportLanguage;
}

export interface ClassificationLine {
  readonly position: string;
  readonly number: string;
  readonly crew: string;
  readonly car: string;
  readonly laps: string;
  readonly leader: string;
  readonly penalty: string;
}

export interface PenaltyLine {
  readonly crews: string;
  readonly decision: string;
  /** In grassetto all'inizio della motivazione. */
  readonly violation: string;
  readonly reason: string;
}

export interface RaceReport {
  readonly language: ReportLanguage;
  readonly title: string;
  readonly classification: readonly ClassificationLine[];
  readonly penalties: readonly PenaltyLine[];
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0');

/** 58 196 → "58.196"; 94 065 → "1:34.065"; oltre l'ora "1:34:10.345" (punto per i millesimi, come nel referto). */
export function formatReportTime(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const fraction = pad(milliseconds % 1000, 3);
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}.${fraction}`;
  if (minutes > 0) return `${minutes}:${pad(seconds)}.${fraction}`;
  return `${seconds}.${fraction}`;
}

const ITALIAN_TEXTS = reportTexts(DEFAULT_REPORT_LANGUAGE);

/** "#16", "#16 e #53", "#21, #46 e #120" (congiunzione della lingua). */
export function joinCarNumbers(numbers: readonly number[], texts: ReportTexts = ITALIAN_TEXTS): string {
  return texts.join([...numbers].sort((first, second) => first - second).map((number) => `#${number}`));
}

/** Vettura citata nella colonna "Decisione". */
export interface DecisionCrew {
  readonly number: number;
  readonly decision: PenaltyDecision | null;
  /** Solo per le reprimende: numero nel ciclo della vettura (1–3). */
  readonly reprimandNumber?: number | null;
}

/**
 * Frase di una decisione per le vetture indicate (sempre nominate, anche se è una sola), come nel referto:
 * "+10 secondi al tempo di gara della vettura #46", "+2 posizioni in griglia di partenza nel Round 7 per la vettura #54".
 */
export function describeDecision(decision: PenaltyDecision, carNumbers: readonly number[], round: number, texts: ReportTexts = ITALIAN_TEXTS): string {
  const isPlural = carNumbers.length > 1;
  const cars = joinCarNumbers(carNumbers, texts);
  const seconds = penaltySeconds(decision);
  if (seconds !== null) return texts.timePenalty(seconds, cars, isPlural);
  const gridPositions = penaltyGridPositions(decision);
  if (gridPositions !== null) return texts.gridPenalty(gridPositions, round + 1, cars, isPlural);
  if (decision === 'race-disqualification') return texts.raceDisqualification(cars, isPlural);
  if (decision === 'championship-disqualification') return texts.championshipDisqualification(cars, isPlural);
  return texts.reprimand(cars, isPlural);
}

/**
 * Reprimende con il loro numero: "Reprimenda per la vettura #16 (1)"; alla terza segue la penalità automatica,
 * "+1 posizione in griglia di partenza nel Round 7 per la vettura #53 (terza reprimenda)".
 */
function describeReprimands(crews: readonly DecisionCrew[], round: number, texts: ReportTexts): string[] {
  const sorted = [...crews].sort((first, second) => first.number - second.number);
  const labels = sorted.map((crew) => (crew.reprimandNumber ? `#${crew.number} (${crew.reprimandNumber})` : `#${crew.number}`));
  const lines = [texts.reprimand(texts.join(labels), sorted.length > 1)];
  const thirdReprimands = sorted.filter((crew) => isReprimandGridPenalty(crew.reprimandNumber ?? null)).map((crew) => crew.number);
  if (thirdReprimands.length > 0) {
    lines.push(
      `${describeDecision(`grid-${REPRIMAND_GRID_POSITIONS}` as PenaltyDecision, thirdReprimands, round, texts)} (${texts.thirdReprimand})`,
    );
  }
  return lines;
}

/**
 * Colonna "Decisione" di una penalità: una riga per ogni decisione presa (le vetture con la stessa decisione
 * insieme, nell'ordine del menu); se nessuna vettura ha una decisione, "Nessuna azione ulteriore".
 */
export function describeDecisions(crews: readonly DecisionCrew[], round: number, texts: ReportTexts = ITALIAN_TEXTS): string {
  const lines = PENALTY_DECISIONS.flatMap((decision) => {
    const decided = crews.filter((crew) => crew.decision === decision);
    if (decided.length === 0) return [];
    if (decision === 'reprimand') return describeReprimands(decided, round, texts);
    return [describeDecision(decision, decided.map((crew) => crew.number), round, texts)];
  });
  return lines.length > 0 ? lines.join('\n') : texts.noFurtherAction;
}

/** Infrazione dei cambi pilota di ogni vettura in millesimi: somma dei cambi non annullati (solo vetture con penalità). */
export function driverSwapInfringementByCrew(driverSwaps: readonly ReportDriverSwapPenalty[]): Map<number, number> {
  const totalByCrew = new Map<number, number>();
  for (const driverSwap of driverSwaps) {
    if (driverSwap.penaltyMs !== null && driverSwap.penaltyMs > 0 && !driverSwap.isCancelled) {
      totalByCrew.set(driverSwap.crewId, (totalByCrew.get(driverSwap.crewId) ?? 0) + driverSwap.penaltyMs);
    }
  }
  return totalByCrew;
}

/** Secondi della penalità dei cambi pilota: l'infrazione arrotondata per eccesso (1,515 → 2). */
export const driverSwapPenaltySeconds = (infringementMs: number): number => Math.ceil(infringementMs / 1000);

/** Millesimi di penalità di ogni vettura: decisioni a tempo + cambi pilota (in secondi interi, per eccesso). */
export function totalPenaltyByCrew(penalties: readonly ReportPenalty[], driverSwaps: readonly ReportDriverSwapPenalty[]): Map<number, number> {
  const totalByCrew = new Map<number, number>();
  const add = (crewId: number, milliseconds: number) => {
    totalByCrew.set(crewId, (totalByCrew.get(crewId) ?? 0) + milliseconds);
  };
  for (const crew of penalties.flatMap((penalty) => penalty.crews)) {
    const seconds = crew.decision === null ? null : penaltySeconds(crew.decision);
    if (seconds !== null) add(crew.crewId, seconds * 1000);
  }
  for (const [crewId, infringementMs] of driverSwapInfringementByCrew(driverSwaps)) add(crewId, driverSwapPenaltySeconds(infringementMs) * 1000);
  return totalByCrew;
}

/**
 * Colonna "Leader": per il primo la durata della gara ("6:00:00.000"; "-" se manca), poi il distacco in tempo o,
 * se manca, i giri in meno ("+1 giro", "+2 giri").
 */
function describeLeaderGap(row: ReportResultRow, leader: ReportResultRow | undefined, texts: ReportTexts, durationHours: number | null): string {
  if (!leader) return '-';
  if (row === leader) return durationHours ? formatReportTime(durationHours * 3_600_000) : '-';
  if (row.gapMs !== null) return `+${formatReportTime(row.gapMs)}`;
  if (row.laps === null || leader.laps === null || leader.laps <= row.laps) return '-';
  return texts.lapsBehind(leader.laps - row.laps);
}

/** Millesimi coi tre decimali e il punto, come i tempi del referto: 1515 → "1.515". */
const formatSecondsWithMilliseconds = (milliseconds: number) => `${Math.floor(milliseconds / 1000)}.${pad(milliseconds % 1000, 3)}`;

/**
 * Penalità dei cambi pilota: una riga per vettura con penalità, nell'ordine della classifica (poi per numero):
 * "+2 secondi al tempo di gara della vettura #54" e "Violazione della procedura di driver swap - Infrazione: 1.515 secondi".
 */
function describeDriverSwapPenalties(
  driverSwaps: readonly ReportDriverSwapPenalty[],
  results: readonly ReportResultRow[],
  crewNumberById: ReadonlyMap<number, number>,
  texts: ReportTexts,
): PenaltyLine[] {
  const positionOf = (crewId: number) => results.find((row) => row.crewId === crewId)?.position ?? Number.MAX_SAFE_INTEGER;
  return [...driverSwapInfringementByCrew(driverSwaps)]
    .flatMap(([crewId, infringementMs]) => {
      const number = crewNumberById.get(crewId);
      return number === undefined ? [] : [{ crewId, number, infringementMs }];
    })
    .sort((first, second) => positionOf(first.crewId) - positionOf(second.crewId) || first.number - second.number)
    .map(({ number, infringementMs }) => ({
      crews: `#${number}`,
      decision: texts.timePenalty(driverSwapPenaltySeconds(infringementMs), `#${number}`, false),
      violation: texts.driverSwapViolation,
      reason: texts.driverSwapInfringement(formatSecondsWithMilliseconds(infringementMs)),
    }));
}

export function buildRaceReport({
  title,
  round,
  durationHours = null,
  results,
  penalties,
  driverSwaps,
  crewNumberById,
  language = DEFAULT_REPORT_LANGUAGE,
}: RaceReportInput): RaceReport {
  const texts = reportTexts(language);
  const totals = totalPenaltyByCrew(penalties, driverSwaps);
  const leader = results[0];
  const numbered = (crews: readonly SavedPenaltyCrew[]): DecisionCrew[] =>
    crews.flatMap((crew) => {
      const number = crewNumberById.get(crew.crewId);
      return number === undefined ? [] : [{ number, decision: crew.decision, reprimandNumber: crew.reprimandNumber }];
    });

  return {
    language,
    title,
    classification: results.map((row) => {
      const totalMs = totals.get(row.crewId) ?? 0;
      return {
        position: String(row.position),
        number: String(row.crewNumber),
        crew: row.crewName,
        car: row.carManufacturer ?? '-',
        laps: row.laps === null ? '-' : String(row.laps),
        leader: describeLeaderGap(row, leader, texts, durationHours),
        penalty: totalMs > 0 ? `+${formatReportTime(totalMs)}` : '',
      };
    }),
    penalties: [
      ...penalties.map((penalty) => ({
      crews: numbered(penalty.crews)
        .map((crew) => crew.number)
        .sort((first, second) => first - second)
        .map((number) => `#${number}`)
        .join(', '),
      decision: describeDecisions(numbered(penalty.crews), round, texts),
      violation: isArticleNumber(penalty.violation) ? texts.violation(penalty.violation, penalty.document) : penalty.violation,
      reason: language === 'en' && penalty.english ? penalty.english.reason : penalty.reason,
      })),
      ...describeDriverSwapPenalties(driverSwaps, results, crewNumberById, texts),
    ],
  };
}

/** Nome del file scaricato: "Referto di gara - 1000 km di Suzuka.pdf", senza caratteri vietati nei nomi di file. */
export function reportFileName(title: string, language: ReportLanguage = DEFAULT_REPORT_LANGUAGE): string {
  return `${reportTexts(language).documentName} - ${title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()}.pdf`;
}
