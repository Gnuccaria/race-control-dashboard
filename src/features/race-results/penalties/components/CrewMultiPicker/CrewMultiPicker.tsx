import { type CSSProperties, useId } from 'react';
import { ColorDot } from '@/components/ui/ColorDot/ColorDot';
import styles from './CrewMultiPicker.module.css';

/** Equipaggio selezionabile: basta id, numero e nome; il colore, se c'è, compare come pallino. */
export interface PickerCrew {
  readonly id: number;
  readonly number: number;
  readonly name: string;
  readonly color?: string | null;
}

interface CrewMultiPickerProps<Crew extends PickerCrew> {
  readonly id: string;
  readonly 'aria-describedby'?: string | undefined;
  /** Vetture selezionabili: quelle del campionato della gara, per numero. */
  readonly crews: readonly Crew[];
  /** Vetture spuntate, nell'ordine di selezione. */
  readonly selectedCrewIds: readonly number[];
  readonly onToggleCrew: (crewId: number) => void;
  /** Nome del gruppo di caselle, per i lettori di schermo. */
  readonly listLabel: string;
  readonly placeholder: string;
  readonly crewOptionLabel: (crew: Crew) => string;
  readonly disabled?: boolean;
  readonly isInvalid?: boolean;
}

/**
 * "Vetture coinvolte": un campo che mostra i numeri scelti come clip e, al clic, apre un elenco a discesa
 * con una casella di spunta per ogni vettura del campionato. L'elenco si apre nel top layer (Popover API,
 * aperto e chiuso dal browser: clic fuori o Esc lo chiudono), ancorato sotto al campo.
 */
export function CrewMultiPicker<Crew extends PickerCrew>({
  id,
  'aria-describedby': describedBy,
  crews,
  selectedCrewIds,
  onToggleCrew,
  listLabel,
  placeholder,
  crewOptionLabel,
  disabled = false,
  isInvalid = false,
}: CrewMultiPickerProps<Crew>) {
  const popoverId = useId();
  const anchorName = `--crew-multi-picker-${popoverId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const crewById = new Map(crews.map((crew) => [crew.id, crew]));
  const selectedCrews = selectedCrewIds.flatMap((crewId) => {
    const crew = crewById.get(crewId);
    return crew ? [crew] : [];
  });
  const selectedIds = new Set(selectedCrewIds);

  return (
    <div className={styles.crewMultiPicker}>
      <button
        id={id}
        type="button"
        className={styles.trigger}
        popoverTarget={popoverId}
        aria-describedby={describedBy}
        aria-invalid={isInvalid || undefined}
        disabled={disabled}
        style={{ anchorName } as CSSProperties}
      >
        {selectedCrews.length === 0 ? (
          <span className={styles.placeholder}>{disabled ? '–' : placeholder}</span>
        ) : (
          <span className={styles.chips}>
            {selectedCrews.map((crew) => (
              <span key={crew.id} className={styles.chip} title={crew.name}>
                #{crew.number}
              </span>
            ))}
          </span>
        )}
        <svg className={styles.chevron} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div id={popoverId} popover="auto" className={styles.dropdown} style={{ positionAnchor: anchorName } as CSSProperties}>
        <fieldset className={styles.options}>
          <legend className={styles.visuallyHidden}>{listLabel}</legend>
          {crews.map((crew) => (
            <label key={crew.id} className={styles.option}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selectedIds.has(crew.id)}
                aria-label={crewOptionLabel(crew)}
                onChange={() => {
                  onToggleCrew(crew.id);
                }}
              />
              <ColorDot color={crew.color ?? null} size="small" />
              <span className={styles.crewNumber}>#{crew.number}</span>
              <span className={styles.crewName}>{crew.name}</span>
            </label>
          ))}
        </fieldset>
      </div>
    </div>
  );
}
