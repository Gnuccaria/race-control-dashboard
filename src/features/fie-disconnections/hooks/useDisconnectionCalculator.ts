import { type DisconnectionTicket, isLeaderPosition } from '@shared/disconnectionTicketRules';
import type { Track } from '@shared/raceRules';
import type { FieldBinding } from '@/components/form/fieldBinding';
import { usePersistentForm } from '@/hooks/usePersistentForm';
import type { TrackChoice } from '@/features/tracks/model/trackSelection';
import { useTrackCatalog } from '@/features/tracks/useTrackCatalog';
import { parsePositiveNumber } from '@/lib/numberParsing';
import {
  DEFAULT_DISCONNECTION_FORM,
  DISCONNECTION_FIELD_PARSERS,
  isAllowedDisconnectionValue,
  toTrackLengthText,
} from '../form/disconnectionForm';
import { computeWaitingTime, type DisconnectedPosition } from '../model/waitingTime';

// v2: la lunghezza non si scrive più a mano ma arriva dalla pista scelta.
const FORM_STORAGE_KEY = 'tools:fie-disconnections:form:v2';

/** Stato del campo Tracciato per il calcolo. */
export type TrackLengthStatus =
  | { readonly kind: 'no-track' }
  | { readonly kind: 'missing-length' }
  | { readonly kind: 'ready'; readonly lengthKm: number };

export function useDisconnectionCalculator() {
  const { form, values, updateField, bindField: bindParsedField } = usePersistentForm({
    storageKey: FORM_STORAGE_KEY,
    defaultForm: DEFAULT_DISCONNECTION_FORM,
    fieldParsers: DISCONNECTION_FIELD_PARSERS,
    isAllowedValue: isAllowedDisconnectionValue,
  });
  const trackCatalog = useTrackCatalog();

  const trackChoice: TrackChoice = {
    trackId: form.trackId === '' ? null : Number(form.trackId),
    isReversed: form.trackReversed === 'true',
  };
  // Appena le piste sono lette dal server vale la loro lunghezza (aggiornata in sottofondo);
  // prima, quella salvata quando la pista è stata scelta.
  const catalogTrack = trackCatalog.findTrack(trackChoice.trackId);
  const trackLengthKm =
    trackChoice.trackId === null
      ? null
      : catalogTrack
        ? catalogTrack.lengthMeters === null
          ? null
          : catalogTrack.lengthMeters / 1000
        : parsePositiveNumber(form.trackLengthKm);
  const trackLengthStatus: TrackLengthStatus =
    trackChoice.trackId === null
      ? { kind: 'no-track' }
      : trackLengthKm === null
        ? { kind: 'missing-length' }
        : { kind: 'ready', lengthKm: trackLengthKm };

  const waitingTime =
    values && trackLengthKm !== null
      ? computeWaitingTime(
          { position: form.position, disconnectedOnLap: values.disconnectedOnLap, gapSeconds: values.gapSeconds },
          {
            driveThroughSeconds: values.driveThroughSeconds,
            stintTotalLaps: values.stintTotalLaps,
            trackLengthKm,
            pitStallEntrySeconds: values.pitStallEntrySeconds,
          },
        )
      : null;

  const selectPosition = (position: DisconnectedPosition) => {
    updateField('position', position);
  };

  // Un campo vuoto (dopo "Invia risultato") non è un errore: manca solo il valore, e il calcolo aspetta.
  const bindField = (fieldName: Parameters<typeof bindParsedField>[0]): FieldBinding => {
    const binding = bindParsedField(fieldName);
    return binding.value.trim() === '' ? { ...binding, errorMessage: undefined } : binding;
  };

  /** Ticket scelto: posizione (P1 se era primo, altrimenti P2–P14), giro e distacco in secondi. */
  const fillFromTicket = (ticket: DisconnectionTicket) => {
    updateField('position', isLeaderPosition(ticket.position) ? 'leader' : 'chasing');
    updateField('disconnectedOnLap', String(ticket.disconnectedOnLap));
    updateField('gapSeconds', String(ticket.gapMs / 1000));
  };

  /** Dopo "Invia risultato": si svuotano solo i dati del ticket (giro e distacco) e la posizione torna P2–P14; pista e stint restano. */
  const clearTicketFields = () => {
    updateField('position', 'chasing');
    updateField('disconnectedOnLap', '');
    updateField('gapSeconds', '');
  };

  const selectTrack = ({ trackId, isReversed }: TrackChoice, track: Track | null) => {
    updateField('trackId', trackId === null ? '' : String(trackId));
    updateField('trackReversed', isReversed ? 'true' : 'false');
    updateField('trackLengthKm', toTrackLengthText(track?.lengthMeters ?? null));
  };

  return {
    position: form.position,
    selectPosition,
    fillFromTicket,
    clearTicketFields,
    bindField,
    trackCatalog,
    trackChoice,
    trackLengthStatus,
    selectTrack,
    waitingTime,
    gapSeconds: values?.gapSeconds ?? 0,
    pitStallEntrySeconds: values?.pitStallEntrySeconds ?? 0,
    driveThroughSeconds: values?.driveThroughSeconds ?? 0,
    stintTotalLaps: values?.stintTotalLaps ?? 0,
    trackLengthKm,
  };
}
