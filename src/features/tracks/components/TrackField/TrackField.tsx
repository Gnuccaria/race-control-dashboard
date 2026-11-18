import type { Track } from '@shared/raceRules';
import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/i18n/useI18n';
import { joinClassNames } from '@/lib/joinClassNames';
import type { TrackCatalog } from '../../useTrackCatalog';
import type { TrackChoice } from '../../model/trackSelection';
import { useTrackLabels } from '../../useTrackLabels';
import styles from './TrackField.module.css';
import { TrackPickerPanel } from './TrackPickerPanel';

interface TrackFieldProps {
  readonly id?: string;
  readonly 'aria-describedby'?: string | undefined;
  readonly value: TrackChoice;
  /** track = configurazione scelta (null se il tracciato viene tolto), per leggerne subito i dati. */
  readonly onValueChange: (choice: TrackChoice, track: Track | null) => void;
  readonly catalog: TrackCatalog;
  /** Sola lettura: mostra la pista scelta ma non apre il popup. */
  readonly disabled?: boolean;
  /** false se il tracciato è obbligatorio: il popup non offre "Togli tracciato". */
  readonly isRemovable?: boolean;
  readonly isInvalid?: boolean;
}

/**
 * Campo Tracciato: mostra "Tracciato - Configurazione [al contrario]" e al clic apre un popup modale
 * con i menu Nazione, Tracciato e Configurazione (in quest'ordine, ognuno abilitato dal precedente).
 * L'elenco delle piste viene riletto dal server a ogni apertura.
 */
export function TrackField({
  id,
  'aria-describedby': describedBy,
  value,
  onValueChange,
  catalog,
  disabled = false,
  isRemovable = true,
  isInvalid = false,
}: TrackFieldProps) {
  const { messages } = useI18n();
  const trackTexts = messages.tracks;
  const { trackLabel } = useTrackLabels();
  const dialogElementRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    const dialogElement = dialogElementRef.current;
    if (!dialogElement) return;
    if (isPickerOpen && !dialogElement.open) dialogElement.showModal();
    if (!isPickerOpen && dialogElement.open) dialogElement.close();
  }, [isPickerOpen]);

  const selectedTrack = catalog.findTrack(value.trackId);
  const selectionLabel =
    value.trackId === null
      ? null
      : selectedTrack
        ? trackLabel(selectedTrack, value.isReversed)
        : catalog.isLoading
          ? trackTexts.loading
          : trackTexts.unknownTrack;

  const closePicker = () => {
    setIsPickerOpen(false);
  };

  return (
    <div className={styles.trackField}>
      <button
        id={id}
        type="button"
        className={joinClassNames(styles.trackTrigger, isInvalid && styles.invalidTrigger)}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        aria-invalid={isInvalid || undefined}
        // Nome completo al passaggio del mouse, se nel campo non ci sta.
        title={selectionLabel ?? undefined}
        onClick={() => {
          catalog.refresh();
          setIsPickerOpen(true);
        }}
      >
        <svg className={styles.triggerIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3.5 13.5V2.5m0 0h8l-1.8 2.75L11.5 8h-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={styles.triggerLabel} data-empty={selectionLabel === null ? true : undefined}>
          {selectionLabel ?? (disabled ? trackTexts.notSet : trackTexts.placeholder)}
        </span>
        {!disabled && (
          <svg className={styles.triggerChevron} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <dialog
        ref={dialogElementRef}
        className={styles.pickerDialog}
        aria-labelledby={dialogTitleId}
        onCancel={(cancelEvent) => {
          cancelEvent.preventDefault();
          closePicker();
        }}
      >
        <h2 id={dialogTitleId} className={styles.pickerTitle}>
          {trackTexts.dialogTitle}
        </h2>
        {isPickerOpen && (
          <TrackPickerPanel
            catalog={catalog}
            initialChoice={value}
            onConfirm={(choice, track) => {
              onValueChange(choice, track);
              closePicker();
            }}
            onRemove={
              isRemovable && value.trackId !== null
                ? () => {
                    onValueChange({ trackId: null, isReversed: false }, null);
                    closePicker();
                  }
                : undefined
            }
            onCancel={closePicker}
          />
        )}
      </dialog>
    </div>
  );
}
