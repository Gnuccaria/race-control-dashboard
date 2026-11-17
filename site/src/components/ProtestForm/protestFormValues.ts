import {
  isProtestVideoType,
  normalizeProtestCorner,
  normalizeProtestDescription,
  PROTEST_CORNER_MAX_LENGTH,
  PROTEST_DESCRIPTION_MAX_LENGTH,
  PROTEST_LAP_MAX,
  PROTEST_LAP_MIN,
  PROTEST_STINT_MAX,
  PROTEST_STINT_MIN,
  PROTEST_VIDEO_MAX_BYTES,
  type ProtestVideoType,
  youtubeVideoIdFrom,
} from '@shared/protestRules';
import type { ProtestSubmission } from '../../api/protests';

/** Video scelto, con il tipo riconosciuto (alcuni browser non lo indicano per i .mov: lo si ricava dall'estensione). */
export interface ChosenVideo {
  readonly file: File;
  readonly type: ProtestVideoType | null;
}

/** Valori del modulo come sono a schermo. */
export interface ProtestFormValues {
  /** Id della gara scelta come testo (valore del menu; '' = nessuna). */
  readonly raceId: string;
  readonly stint: string;
  readonly lap: string;
  readonly corner: string;
  readonly description: string;
  readonly youtubeUrl: string;
  readonly otherCrewIds: readonly number[];
  readonly video: ChosenVideo | null;
}

export const EMPTY_PROTEST_VALUES: ProtestFormValues = { raceId: '', stint: '', lap: '', corner: '', description: '', youtubeUrl: '', otherCrewIds: [], video: null };

const TYPES_BY_EXTENSION: Readonly<Record<string, ProtestVideoType>> = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

export function chooseVideo(file: File): ChosenVideo {
  if (isProtestVideoType(file.type)) return { file, type: file.type };
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return { file, type: TYPES_BY_EXTENSION[extension] ?? null };
}

export type VideoIssue = 'invalid-type' | 'too-large';

export interface ProtestFormCheck {
  readonly isStintInvalid: boolean;
  readonly isLapInvalid: boolean;
  readonly isCornerInvalid: boolean;
  readonly isYoutubeInvalid: boolean;
  readonly videoIssue: VideoIssue | null;
  /** Caratteri ancora disponibili nella descrizione. */
  readonly remainingCharacters: number;
  /** Dati da inviare, solo se i campi obbligatori ci sono e tutto è valido. */
  readonly submission: ProtestSubmission | null;
}

const parseBetween = (text: string, min: number, max: number): number | null => {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
};

export function checkProtestForm(values: ProtestFormValues): ProtestFormCheck {
  const stint = parseBetween(values.stint, PROTEST_STINT_MIN, PROTEST_STINT_MAX);
  const lap = parseBetween(values.lap, PROTEST_LAP_MIN, PROTEST_LAP_MAX);
  const corner = normalizeProtestCorner(values.corner);
  const isCornerInvalid = [...corner].length > PROTEST_CORNER_MAX_LENGTH;
  const description = normalizeProtestDescription(values.description);
  const youtubeUrl = values.youtubeUrl.trim();
  const isYoutubeInvalid = youtubeUrl !== '' && youtubeVideoIdFrom(youtubeUrl) === null;
  const videoIssue: VideoIssue | null = !values.video
    ? null
    : values.video.type === null
      ? 'invalid-type'
      : values.video.file.size > PROTEST_VIDEO_MAX_BYTES
        ? 'too-large'
        : null;
  const raceId = /^\d{1,9}$/.test(values.raceId) ? Number(values.raceId) : null;
  const isComplete = raceId !== null && stint !== null && lap !== null && corner !== '' && !isCornerInvalid && description.length <= PROTEST_DESCRIPTION_MAX_LENGTH;
  return {
    isStintInvalid: values.stint !== '' && stint === null,
    isLapInvalid: values.lap !== '' && lap === null,
    isCornerInvalid,
    isYoutubeInvalid,
    videoIssue,
    remainingCharacters: PROTEST_DESCRIPTION_MAX_LENGTH - values.description.length,
    submission:
      isComplete && !isYoutubeInvalid && videoIssue === null
        ? { raceId: raceId as number, stint: stint as number, lap: lap as number, corner, description, youtubeUrl, otherCrewIds: values.otherCrewIds }
        : null,
  };
}

/** "12,4 MB" / "12.4 MB" nella lingua del sito. */
export const formatMegabytes = (bytes: number, locale: string) =>
  `${(bytes / 1_000_000).toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: bytes < 10_000_000 ? 1 : 0 })} MB`;
