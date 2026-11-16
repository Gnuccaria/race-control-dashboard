import type { TicketResultDetails } from '@shared/disconnectionTicketRules';
import { excelInt } from '@/lib/excel';

/**
 * - leader: il disconnesso era in P1 → si confronta con la P2 e si aggiunge l'ingresso in pit stall
 * - chasing: il disconnesso era tra P2 e P14 → si aggiunge il distacco dal leader
 */
export type DisconnectedPosition = 'chasing' | 'leader';

export const DISCONNECTED_POSITIONS: readonly DisconnectedPosition[] = ['chasing', 'leader'];

export const isDisconnectedPosition = (value: unknown): value is DisconnectedPosition =>
  DISCONNECTED_POSITIONS.some((position) => position === value);

/** Variabili della pista, fisse per tutto lo stint. */
export interface TrackSettings {
  readonly driveThroughSeconds: number;
  readonly stintTotalLaps: number;
  readonly trackLengthKm: number;
  /** Usato solo per la disconnessione della P1. */
  readonly pitStallEntrySeconds: number;
}

/** Valori presi dal ticket della disconnessione. */
export interface DisconnectionTicket {
  readonly position: DisconnectedPosition;
  readonly disconnectedOnLap: number;
  /** Distacco dal leader (P2–P14) oppure dalla P2 (P1), in secondi. */
  readonly gapSeconds: number;
}

export interface WaitingTime {
  readonly missingLaps: number;
  readonly penaltySeconds: number;
  readonly totalWaitSeconds: number;
  readonly minutes: number;
  readonly seconds: number;
}

/**
 * Traduzione 1:1 del foglio "Disconnessioni FIE".
 * P2–P14: celle Z4, Z5, C8, D8 · P1: celle Z14, K15, G8, H8.
 */
export function computeWaitingTime(ticket: DisconnectionTicket, track: TrackSettings): WaitingTime {
  const missingLaps = track.stintTotalLaps - ticket.disconnectedOnLap + 1;
  const penaltySeconds = missingLaps * track.trackLengthKm + track.driveThroughSeconds;

  const totalWaitSeconds =
    ticket.position === 'leader'
      ? penaltySeconds - ticket.gapSeconds + track.pitStallEntrySeconds
      : penaltySeconds + ticket.gapSeconds;

  const minutes = excelInt(totalWaitSeconds / 60);
  const seconds = excelInt(totalWaitSeconds - minutes * 60);

  return { missingLaps, penaltySeconds, totalWaitSeconds, minutes, seconds };
}

/** Tempo di attesa dal dettaglio salvato con il risultato di un ticket (per mostrarlo sul sito). */
export function waitingTimeFromDetails(details: TicketResultDetails): WaitingTime {
  const minutes = excelInt(details.totalWaitSeconds / 60);
  return {
    missingLaps: details.missingLaps,
    penaltySeconds: details.penaltySeconds,
    totalWaitSeconds: details.totalWaitSeconds,
    minutes,
    seconds: excelInt(details.totalWaitSeconds - minutes * 60),
  };
}
