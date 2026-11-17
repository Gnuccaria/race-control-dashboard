import { formatCarName, matchCarLines } from '@shared/carRules';
import { useState } from 'react';
import { FormField } from '@/components/form/FormField/FormField';
import { Button } from '@/components/ui/Button/Button';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Select } from '@/components/ui/Select/Select';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { useCarCatalog } from '@/features/cars/useCarCatalog';
import { useI18n } from '@/i18n/useI18n';
import type { ChampionshipDraftState } from '../../hooks/useChampionshipDraft';
import styles from '../ChampionshipFields/ChampionshipFields.module.css';
import { RemoveIcon } from '../RemoveIcon';

interface ChampionshipCarsFieldProps {
  readonly draft: ChampionshipDraftState;
  readonly isReadOnly: boolean;
}

/**
 * Vetture ammesse, scelte dal catalogo delle auto: una alla volta (menu + "Aggiungi vettura") oppure scritte una
 * per riga e aggiunte insieme (le righe non riconosciute restano nel campo, segnalate). La X toglie una vettura.
 */
export function ChampionshipCarsField({ draft, isReadOnly }: ChampionshipCarsFieldProps) {
  const { locale, messages } = useI18n();
  const texts = messages.championships;
  const carCatalog = useCarCatalog();
  const [chosenCarId, setChosenCarId] = useState('');
  const [carLines, setCarLines] = useState('');
  const [unknownLines, setUnknownLines] = useState<readonly string[]>([]);

  const carName = (carId: number) => carCatalog.carNameById.get(carId) ?? (carCatalog.isLoading ? messages.cars.loading : messages.cars.unknownCar);
  const selectedCarIds = [...draft.values.carIds].sort((first, second) => carName(first).localeCompare(carName(second), locale));
  const availableCars = carCatalog.cars.filter((car) => !draft.values.carIds.includes(car.id));

  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{texts.cars}</legend>
      {!isReadOnly && <p className={styles.hint}>{texts.carsHint}</p>}
      {selectedCarIds.length === 0 ? (
        <p className={styles.hint}>{texts.noCars}</p>
      ) : (
        <ul className={styles.carList} aria-label={texts.cars}>
          {selectedCarIds.map((carId) => (
            <li key={carId} className={styles.carItem}>
              <span>{carName(carId)}</span>
              {!isReadOnly && (
                <IconButton accessibleLabel={texts.removeCar(carName(carId))} title={texts.removeCar(carName(carId))} onClick={() => draft.removeCar(carId)}>
                  <RemoveIcon />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}

      {!isReadOnly && (
        <>
          <div className={styles.addCarRow}>
            <Select
              aria-label={texts.chooseCar}
              placeholderLabel={carCatalog.isLoading ? messages.cars.loading : texts.chooseCar}
              value={availableCars.some((car) => String(car.id) === chosenCarId) ? chosenCarId : ''}
              options={availableCars.map((car) => ({ value: String(car.id), label: formatCarName(car) }))}
              onValueChange={setChosenCarId}
              onFocus={carCatalog.refresh}
            />
            <Button
              variant="secondary"
              disabled={chosenCarId === ''}
              onClick={() => {
                draft.addCars([Number(chosenCarId)]);
                setChosenCarId('');
              }}
            >
              {texts.addCar}
            </Button>
          </div>
          <FormField
            label={texts.carLines}
            hint={texts.carLinesHint}
            errorMessage={unknownLines.length > 0 ? texts.unknownCarLines(unknownLines.join(', ')) : undefined}
          >
            {({ isInvalid, ...textareaAttributes }) => (
              <Textarea {...textareaAttributes} rows={4} spellCheck={false} isInvalid={isInvalid} value={carLines} onValueChange={setCarLines} />
            )}
          </FormField>
          <Button
            variant="secondary"
            className={styles.addButton}
            disabled={carLines.trim() === ''}
            onClick={() => {
              const { carIds, unknownLines: unknown } = matchCarLines(carLines, carCatalog.cars);
              draft.addCars(carIds);
              setUnknownLines(unknown);
              // Restano solo le righe da correggere.
              setCarLines(unknown.join('\n'));
            }}
          >
            {texts.addCarLines}
          </Button>
        </>
      )}
      {carCatalog.errorKind && !isReadOnly && <p className={styles.rowError}>{messages.serverErrors[carCatalog.errorKind]}</p>}
    </fieldset>
  );
}
