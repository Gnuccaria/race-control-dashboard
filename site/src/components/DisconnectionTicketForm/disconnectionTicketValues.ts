import {
  type DisconnectionTicketReport,
  isLeaderPosition,
  parseTicketGap,
  TICKET_LAP_MAX,
  TICKET_POSITION_MAX,
  TICKET_POSITION_MIN,
} from '@shared/disconnectionTicketRules';

/** Valori del modulo come sono a schermo (l'equipaggio non si scrive: arriva dal ruolo Discord). */
export interface TicketFormValues {
  readonly position: string;
  readonly gap: string;
  readonly disconnectedOnLap: string;
}

export const EMPTY_TICKET_VALUES: TicketFormValues = { position: '', gap: '', disconnectedOnLap: '' };

/** Numero intero scritto con sole cifre, dentro i limiti; null altrimenti. */
function readInteger(text: string, min: number, max: number): number | null {
  if (!/^\d{1,4}$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return value >= min && value <= max ? value : null;
}

export interface TicketFormCheck {
  readonly isPositionInvalid: boolean;
  readonly isGapInvalid: boolean;
  readonly isLapInvalid: boolean;
  /** In P1 il distacco è dalla P2. */
  readonly isLeader: boolean;
  /** Dati pronti da inviare, oppure null se manca qualcosa o qualcosa non va. */
  readonly ticket: DisconnectionTicketReport | null;
}

export function checkTicketForm(values: TicketFormValues): TicketFormCheck {
  const position = readInteger(values.position, TICKET_POSITION_MIN, TICKET_POSITION_MAX);
  const gapMs = parseTicketGap(values.gap);
  const disconnectedOnLap = readInteger(values.disconnectedOnLap, 0, TICKET_LAP_MAX);
  const isGapValid = gapMs !== null && !Number.isNaN(gapMs);
  return {
    isPositionInvalid: values.position.trim() !== '' && position === null,
    isGapInvalid: values.gap.trim() !== '' && !isGapValid,
    isLapInvalid: values.disconnectedOnLap.trim() !== '' && disconnectedOnLap === null,
    isLeader: position !== null && isLeaderPosition(position),
    ticket:
      position !== null && isGapValid && disconnectedOnLap !== null
        ? { position, gapMs: gapMs as number, disconnectedOnLap }
        : null,
  };
}

/** Mentre si scrive, nei campi numerici restano solo le cifre. */
export const digitsOnly = (rawValue: string, maxLength: number): string => rawValue.replace(/\D/g, '').slice(0, maxLength);
