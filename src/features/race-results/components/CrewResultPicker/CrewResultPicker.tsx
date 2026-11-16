import type { SavedCrew } from '@shared/crewRules';
import { type CSSProperties, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import styles from './CrewResultPicker.module.css';

interface CrewResultPickerProps {
  /** Equipaggi selezionabili (solo quelli del campionato della gara). */
  readonly crews: readonly SavedCrew[];
  /** Equipaggio scelto, cercato fra tutti gli equipaggi: resta visibile anche se ha cambiato campionato. */
  readonly selectedCrew: SavedCrew | null;
  readonly onSelectCrew: (crewId: number | null) => void;
  readonly label: string;
  readonly placeholder: string;
  readonly clearLabel: string;
  readonly disabled?: boolean;
  readonly isInvalid?: boolean;
  readonly 'aria-describedby'?: string | undefined;
}

/** Contenuto di una voce: cerchio del colore, #numero e nome. */
function CrewOptionContent({ crew }: { readonly crew: SavedCrew }) {
  return (
    <>
      <span
        className={styles.colorDot}
        style={crew.color ? { backgroundColor: crew.color } : undefined}
        data-empty={crew.color ? undefined : true}
        aria-hidden="true"
      />
      <span className={styles.crewNumber}>#{crew.number}</span>
      <span className={styles.crewName}>{crew.name}</span>
    </>
  );
}

/**
 * Menu degli equipaggi per una posizione dell'ordine di arrivo. Il menu nativo non può mostrare
 * il cerchio colorato, quindi è un combobox con elenco (pattern ARIA): frecce per spostarsi,
 * Invio per scegliere, Esc per chiudere. L'elenco si apre nel top layer (Popover API),
 * ancorato al pulsante, così non viene tagliato dalla tabella che scorre.
 */
export function CrewResultPicker({
  crews,
  selectedCrew,
  onSelectCrew,
  label,
  placeholder,
  clearLabel,
  disabled = false,
  isInvalid = false,
  'aria-describedby': describedBy,
}: CrewResultPickerProps) {
  const listboxId = useId();
  const anchorName = `--crew-picker-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  // Il clic sul pulsante con l'elenco aperto chiude l'elenco ("clic fuori") prima del click: non va riaperto.
  const wasOpenAtPointerDownRef = useRef(false);
  // Voce evidenziata: -1 = "nessun equipaggio", poi gli indici di crews.
  const [activeIndex, setActiveIndex] = useState(-1);

  const optionIds = (index: number) => `${listboxId}-option-${index}`;

  const openListbox = () => {
    if (disabled) return;
    setActiveIndex(selectedCrew ? crews.findIndex((crew) => crew.id === selectedCrew.id) : -1);
    setIsOpen(true);
  };

  const closeListbox = (shouldFocusTrigger: boolean) => {
    setIsOpen(false);
    if (shouldFocusTrigger) triggerRef.current?.focus();
  };

  const chooseOption = (index: number) => {
    onSelectCrew(index === -1 ? null : (crews[index]?.id ?? null));
    closeListbox(true);
  };

  // Apertura nel top layer e chiusura quando il browser la chiude da solo (clic fuori, Esc).
  useEffect(() => {
    const listboxElement = listboxRef.current;
    if (!isOpen || !listboxElement) return;
    if (typeof listboxElement.showPopover === 'function' && !listboxElement.matches(':popover-open')) {
      listboxElement.showPopover();
    }
    listboxElement.focus();
    const handleToggle = (toggleEvent: Event) => {
      if ((toggleEvent as ToggleEvent).newState === 'closed') setIsOpen(false);
    };
    listboxElement.addEventListener('toggle', handleToggle);
    return () => {
      listboxElement.removeEventListener('toggle', handleToggle);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) listboxRef.current?.querySelector(`#${CSS.escape(optionIds(activeIndex))}`)?.scrollIntoView({ block: 'nearest' });
  });

  const handleTriggerKeyDown = (keyboardEvent: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(keyboardEvent.key)) {
      keyboardEvent.preventDefault();
      openListbox();
    }
  };

  const handleListboxKeyDown = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    const lastIndex = crews.length - 1;
    const nextIndexByKey: Partial<Record<string, number>> = {
      ArrowDown: Math.min(activeIndex + 1, lastIndex),
      ArrowUp: Math.max(activeIndex - 1, -1),
      Home: -1,
      End: lastIndex,
    };
    const nextIndex = nextIndexByKey[keyboardEvent.key];
    if (nextIndex !== undefined) {
      keyboardEvent.preventDefault();
      setActiveIndex(nextIndex);
    } else if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
      keyboardEvent.preventDefault();
      chooseOption(activeIndex);
    } else if (keyboardEvent.key === 'Escape' || keyboardEvent.key === 'Tab') {
      keyboardEvent.preventDefault();
      closeListbox(true);
    }
  };

  return (
    <div className={styles.crewResultPicker}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-invalid={isInvalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        className={styles.trigger}
        style={{ anchorName } as CSSProperties}
        onPointerDown={() => {
          wasOpenAtPointerDownRef.current = isOpen;
        }}
        onClick={() => {
          if (wasOpenAtPointerDownRef.current || isOpen) {
            wasOpenAtPointerDownRef.current = false;
            closeListbox(false);
          } else {
            openListbox();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        {selectedCrew ? <CrewOptionContent crew={selectedCrew} /> : <span className={styles.placeholder}>{placeholder}</span>}
        <svg className={styles.chevron} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label={label}
          aria-activedescendant={optionIds(activeIndex)}
          tabIndex={-1}
          popover="auto"
          className={styles.listbox}
          style={{ positionAnchor: anchorName } as CSSProperties}
          onKeyDown={handleListboxKeyDown}
        >
          <div
            id={optionIds(-1)}
            role="option"
            aria-selected={selectedCrew === null}
            data-active={activeIndex === -1 || undefined}
            className={styles.option}
            onPointerEnter={() => {
              setActiveIndex(-1);
            }}
            onClick={() => {
              chooseOption(-1);
            }}
          >
            <span className={styles.placeholder}>{clearLabel}</span>
          </div>
          {crews.map((crew, index) => (
            <div
              key={crew.id}
              id={optionIds(index)}
              role="option"
              aria-selected={selectedCrew?.id === crew.id}
              data-active={activeIndex === index || undefined}
              className={styles.option}
              onPointerEnter={() => {
                setActiveIndex(index);
              }}
              onClick={() => {
                chooseOption(index);
              }}
            >
              <CrewOptionContent crew={crew} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
