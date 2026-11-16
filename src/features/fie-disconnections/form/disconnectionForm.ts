import type { FieldParser } from '@/lib/form/parseFormFields';
import { parseNumberAtLeast, parsePositiveNumber } from '@/lib/numberParsing';
import { type DisconnectedPosition, isDisconnectedPosition } from '../model/waitingTime';

export interface DisconnectionForm extends Record<string, string> {
  readonly position: DisconnectedPosition;
  readonly disconnectedOnLap: string;
  readonly gapSeconds: string;
  readonly driveThroughSeconds: string;
  readonly stintTotalLaps: string;
  /** Pista scelta nel campo Tracciato ('' = nessuna) e senso di marcia ('true'/'false'). */
  readonly trackId: string;
  readonly trackReversed: string;
  /** Lunghezza in km della pista scelta, salvata alla scelta: serve finché le piste del server non sono lette. */
  readonly trackLengthKm: string;
  readonly pitStallEntrySeconds: string;
}

/** Valori di esempio presenti nel foglio originale (caso P2–P14); la pista si sceglie dal campo Tracciato. */
export const DEFAULT_DISCONNECTION_FORM: DisconnectionForm = {
  position: 'chasing',
  disconnectedOnLap: '1',
  gapSeconds: '43',
  driveThroughSeconds: '22',
  stintTotalLaps: '29',
  trackId: '',
  trackReversed: 'false',
  trackLengthKm: '',
  pitStallEntrySeconds: '9',
};

const parseNonNegativeNumber = parseNumberAtLeast(0);

export const DISCONNECTION_FIELD_PARSERS = {
  disconnectedOnLap: { parse: parseNonNegativeNumber, errorKey: 'lapNonNegative' },
  gapSeconds: { parse: parseNonNegativeNumber, errorKey: 'gapNonNegative' },
  driveThroughSeconds: { parse: parseNonNegativeNumber, errorKey: 'durationNonNegative' },
  stintTotalLaps: { parse: parseNonNegativeNumber, errorKey: 'lapsNonNegative' },
  pitStallEntrySeconds: { parse: parseNonNegativeNumber, errorKey: 'durationNonNegative' },
} satisfies Record<string, FieldParser<unknown>>;

export function isAllowedDisconnectionValue(fieldName: keyof DisconnectionForm, value: string): boolean {
  switch (fieldName) {
    case 'position':
      return isDisconnectedPosition(value);
    case 'trackId':
      return value === '' || /^[1-9]\d*$/.test(value);
    case 'trackReversed':
      return value === 'true' || value === 'false';
    case 'trackLengthKm':
      return value === '' || parsePositiveNumber(value) !== null;
    default:
      return true;
  }
}

/** Lunghezza in km come testo del form ('' se la pista non ha lunghezza). */
export const toTrackLengthText = (lengthMeters: number | null): string => (lengthMeters === null ? '' : String(lengthMeters / 1000));
