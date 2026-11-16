import type { PenaltyDocument } from '../../../shared/penaltyRules';

/** Frase fissa della violazione in italiano (es. "Violazione dell’art. 2.4 del C.d.C."). */
const italianViolation = (article: string, document: PenaltyDocument) =>
  `Violazione dell’art. ${article} del ${document === 'code-of-conduct' ? 'C.d.C.' : 'Reg. Tec.'}`;

/**
 * Testi del referto: italiano (il modello, referto della 1000 km di Suzuka) e inglese, usato per tutte le altre
 * lingue del sito. La motivazione non è qui: la scrive la Direzione Gara e nel referto inglese si usa la sua
 * traduzione salvata. La violazione è una frase fissa con numero dell'articolo e documento, in inglese con le
 * sigle inglesi (C. C. = Code of Conduct, Tech. Reg. = Technical Regulations).
 */

/** Il referto è in italiano o in inglese: ogni lingua del sito diversa dall'italiano riceve quello inglese. */
export const REPORT_LANGUAGES = ['it', 'en'] as const;
export type ReportLanguage = (typeof REPORT_LANGUAGES)[number];
export const DEFAULT_REPORT_LANGUAGE: ReportLanguage = 'it';

/** "?lang=it" → italiano; qualunque altra lingua (en, fr, de…) → inglese; senza lingua → italiano. */
export function readReportLanguage(rawValue: string | null): ReportLanguage {
  const language = rawValue?.trim().toLowerCase().slice(0, 2) ?? '';
  if (language === '' || language === 'it') return 'it';
  return 'en';
}

export interface ReportTexts {
  /** Lingua dichiarata nel PDF. */
  readonly pdfLanguage: string;
  /** "Referto di gara": titolo del documento, intestazioni e nome del file. */
  readonly documentName: string;
  readonly classificationTitle: string;
  readonly classificationColumns: readonly [string, string, string, string, string, string, string];
  readonly noClassification: string;
  readonly penaltiesTitle: string;
  readonly penaltiesIntro: string;
  readonly penaltyColumns: readonly [string, string, string];
  readonly noPenalties: string;
  readonly lapsBehind: (laps: number) => string;
  readonly noFurtherAction: string;
  /** "A", "A e B", "A, B e C". */
  readonly join: (labels: readonly string[]) => string;
  /** "+10 secondi al tempo di gara della vettura #46". */
  readonly timePenalty: (seconds: number, cars: string, isPlural: boolean) => string;
  /** "+2 posizioni in griglia di partenza nel Round 7 per la vettura #54". */
  readonly gridPenalty: (positions: number, round: number, cars: string, isPlural: boolean) => string;
  readonly raceDisqualification: (cars: string, isPlural: boolean) => string;
  readonly championshipDisqualification: (cars: string, isPlural: boolean) => string;
  /** "Reprimenda per la vettura #16 (1)". */
  readonly reprimand: (cars: string, isPlural: boolean) => string;
  /** Aggiunto alla penalità in griglia automatica della terza reprimenda. */
  readonly thirdReprimand: string;
  /** "Violazione dell’art. 2.4 del C.d.C." */
  readonly violation: (article: string, document: PenaltyDocument) => string;
}

const joinWith = (conjunction: string) => (labels: readonly string[]) =>
  labels.length <= 1 ? labels.join('') : `${labels.slice(0, -1).join(', ')} ${conjunction} ${labels.at(-1) ?? ''}`;

const ITALIAN: ReportTexts = {
  pdfLanguage: 'it-IT',
  documentName: 'Referto di gara',
  classificationTitle: '1. CLASSIFICA FINALE DI GARA',
  classificationColumns: ['Pos.', 'N.', 'Equipaggio', 'Vettura', 'Giri', 'Leader', 'Penalità'],
  noClassification: 'Classifica non ancora inserita.',
  penaltiesTitle: '2. PENALITÀ',
  penaltiesIntro: 'Sono di seguito riportati tutti i reclami e le penalità comminate.',
  penaltyColumns: ['Auto coinvolte', 'Decisione', 'Motivazione'],
  noPenalties: 'Nessuna penalità.',
  lapsBehind: (laps) => `+${laps} ${laps === 1 ? 'giro' : 'giri'}`,
  noFurtherAction: 'Nessuna azione ulteriore',
  join: joinWith('e'),
  timePenalty: (seconds, cars, isPlural) => `+${seconds} secondi al tempo di gara ${isPlural ? 'delle vetture' : 'della vettura'} ${cars}`,
  gridPenalty: (positions, round, cars, isPlural) =>
    `+${positions} ${positions === 1 ? 'posizione' : 'posizioni'} in griglia di partenza nel Round ${round} per ${isPlural ? 'le vetture' : 'la vettura'} ${cars}`,
  raceDisqualification: (cars, isPlural) => `Squalifica dalla gara ${isPlural ? 'delle vetture' : 'della vettura'} ${cars}`,
  championshipDisqualification: (cars, isPlural) => `Squalifica dal campionato ${isPlural ? 'delle vetture' : 'della vettura'} ${cars}`,
  reprimand: (cars, isPlural) => `Reprimenda per ${isPlural ? 'le vetture' : 'la vettura'} ${cars}`,
  thirdReprimand: 'terza reprimenda',
  violation: italianViolation,
};

const ENGLISH: ReportTexts = {
  pdfLanguage: 'en-GB',
  documentName: 'Race report',
  classificationTitle: '1. FINAL RACE CLASSIFICATION',
  classificationColumns: ['Pos.', 'No.', 'Team', 'Car', 'Laps', 'Leader', 'Penalty'],
  noClassification: 'Classification not yet available.',
  penaltiesTitle: '2. PENALTIES',
  penaltiesIntro: 'All protests and penalties imposed are listed below.',
  penaltyColumns: ['Cars involved', 'Decision', 'Reason'],
  noPenalties: 'No penalties.',
  lapsBehind: (laps) => `+${laps} ${laps === 1 ? 'lap' : 'laps'}`,
  noFurtherAction: 'No further action',
  join: joinWith('and'),
  timePenalty: (seconds, cars, isPlural) => `+${seconds} seconds added to the race time of ${isPlural ? 'cars' : 'car'} ${cars}`,
  gridPenalty: (positions, round, cars, isPlural) =>
    `+${positions} starting grid ${positions === 1 ? 'position' : 'positions'} in Round ${round} for ${isPlural ? 'cars' : 'car'} ${cars}`,
  raceDisqualification: (cars, isPlural) => `Disqualification from the race of ${isPlural ? 'cars' : 'car'} ${cars}`,
  championshipDisqualification: (cars, isPlural) => `Disqualification from the championship of ${isPlural ? 'cars' : 'car'} ${cars}`,
  reprimand: (cars, isPlural) => `Reprimand for ${isPlural ? 'cars' : 'car'} ${cars}`,
  thirdReprimand: 'third reprimand',
  violation: (article, document) => `Breach of Art. ${article} of the ${document === 'code-of-conduct' ? 'C. C.' : 'Tech. Reg.'}`,
};

const TEXTS_BY_LANGUAGE: Record<ReportLanguage, ReportTexts> = { it: ITALIAN, en: ENGLISH };

export const reportTexts = (language: ReportLanguage): ReportTexts => TEXTS_BY_LANGUAGE[language];
