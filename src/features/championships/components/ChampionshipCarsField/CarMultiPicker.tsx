import { type Car, CAR_GROUPS, type CarGroup, formatCarName } from '@shared/carRules';
import { type CSSProperties, useId, useRef } from 'react';
import styles from '@/features/race-results/penalties/components/CrewMultiPicker/CrewMultiPicker.module.css';
import pickerStyles from './CarMultiPicker.module.css';

interface CarMultiPickerProps {
  readonly id: string;
  readonly 'aria-describedby'?: string | undefined;
  /** Auto del catalogo, in ordine alfabetico. */
  readonly cars: readonly Car[];
  /** Gruppo delle vetture mostrate nell'elenco ('' = tutti); le clip mostrano sempre tutte le scelte. */
  readonly group: CarGroup | '';
  readonly selectedCarIds: readonly number[];
  /** Vetture che non si possono togliere (usate da almeno un equipaggio): la casella resta spuntata e bloccata. */
  readonly lockedCarIds: readonly number[];
  readonly onToggleCar: (carId: number) => void;
  readonly listLabel: string;
  readonly placeholder: string;
  readonly lockedTitle: (carName: string) => string;
  /** Nome accessibile della X di una clip: "Togli Audi R8 LMS Evo '19". */
  readonly removeLabel: (carName: string) => string;
  readonly disabled?: boolean;
  /** Al primo clic sul campo si rileggono le auto dal server. */
  readonly onOpen?: () => void;
}

/**
 * Vetture ammesse, come "Altri equipaggi coinvolti": il campo mostra le vetture scelte come clip, ognuna con la X per
 * toglierla (non quelle usate da un equipaggio), e al clic apre un elenco a discesa (Popover API) con una casella di
 * spunta per ogni auto del catalogo. Le X sono pulsanti a sé: per questo il campo è un riquadro con dentro il pulsante
 * che apre l'elenco (la freccia), e un clic sul riquadro fuori dalle X apre l'elenco anche lui.
 */
export function CarMultiPicker({
  id,
  'aria-describedby': describedBy,
  cars,
  group,
  selectedCarIds,
  lockedCarIds,
  onToggleCar,
  listLabel,
  placeholder,
  lockedTitle,
  removeLabel,
  disabled = false,
  onOpen,
}: CarMultiPickerProps) {
  const popoverId = useId();
  const anchorName = `--car-multi-picker-${popoverId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const selectedCars = cars.filter((car) => selectedCarIds.includes(car.id));
  // Nell'elenco: solo il gruppo scelto, per gruppo (Gr.1 → Gr.4) e poi in ordine alfabetico.
  const groupOrder = (car: Car) => (car.group ? CAR_GROUPS.indexOf(car.group) : CAR_GROUPS.length);
  const optionCars = cars
    .filter((car) => group === '' || car.group === group)
    .sort((first, second) => groupOrder(first) - groupOrder(second) || formatCarName(first).localeCompare(formatCarName(second)));

  const toggleRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={styles.crewMultiPicker}>
      <div
        className={`${styles.trigger} ${pickerStyles.field}`}
        data-disabled={disabled || undefined}
        style={{ anchorName } as CSSProperties}
        onClick={(clickEvent) => {
          if (!disabled && !(clickEvent.target as HTMLElement).closest('button')) toggleRef.current?.click();
        }}
      >
        {selectedCars.length === 0 ? (
          <span className={styles.placeholder}>{disabled ? '–' : placeholder}</span>
        ) : (
          <span className={styles.chips} aria-label={listLabel}>
            {selectedCars.map((car) => {
              const name = formatCarName(car);
              const isLocked = lockedCarIds.includes(car.id);
              return (
                <span key={car.id} className={`${styles.chip} ${pickerStyles.chip}`} title={isLocked && !disabled ? lockedTitle(name) : undefined}>
                  {name}
                  {!disabled && !isLocked && (
                    <button type="button" className={pickerStyles.chipRemove} aria-label={removeLabel(name)} title={removeLabel(name)} onClick={() => onToggleCar(car.id)}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="m2.5 2.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </span>
              );
            })}
          </span>
        )}
        <button
          ref={toggleRef}
          id={id}
          type="button"
          className={pickerStyles.toggle}
          popoverTarget={popoverId}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={onOpen}
        >
          <svg className={styles.chevron} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div id={popoverId} popover="auto" className={styles.dropdown} style={{ positionAnchor: anchorName } as CSSProperties}>
        <fieldset className={styles.options}>
          <legend className={styles.visuallyHidden}>{listLabel}</legend>
          {optionCars.map((car) => {
            const isLocked = lockedCarIds.includes(car.id) && selectedCarIds.includes(car.id);
            return (
              <label key={car.id} className={styles.option} title={isLocked ? lockedTitle(formatCarName(car)) : undefined}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selectedCarIds.includes(car.id)}
                  disabled={isLocked}
                  aria-label={formatCarName(car)}
                  onChange={() => {
                    onToggleCar(car.id);
                  }}
                />
                <span className={styles.crewName}>{formatCarName(car)}</span>
              </label>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
}
