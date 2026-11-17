import { CAR_GROUPS, type CarGroup, formatCarName } from '@shared/carRules';
import { useState } from 'react';
import { FormField } from '@/components/form/FormField/FormField';
import { Select } from '@/components/ui/Select/Select';
import { useCarCatalog } from '@/features/cars/useCarCatalog';
import { useI18n } from '@/i18n/useI18n';
import type { ChampionshipDraftState } from '../../hooks/useChampionshipDraft';
import styles from '../ChampionshipFields/ChampionshipFields.module.css';
import { CarMultiPicker } from './CarMultiPicker';
import { serverErrorText } from '@/services/serverErrorText';

interface ChampionshipCarsFieldProps {
  readonly draft: ChampionshipDraftState;
  readonly isReadOnly: boolean;
  /** Vetture usate da almeno un equipaggio del campionato: non si possono togliere. */
  readonly lockedCarIds: readonly number[];
}

/**
 * Vetture ammesse, scelte dal catalogo delle auto con le caselle di spunta e mostrate come clip.
 * Il filtro Gruppo accanto restringe l'elenco alle vetture di un gruppo, per trovarle prima.
 */
export function ChampionshipCarsField({ draft, isReadOnly, lockedCarIds }: ChampionshipCarsFieldProps) {
  const { messages } = useI18n();
  const texts = messages.championships;
  const carCatalog = useCarCatalog();
  const [group, setGroup] = useState<CarGroup | ''>('');
  const lockedNames = carCatalog.cars.filter((car) => lockedCarIds.includes(car.id) && draft.values.carIds.includes(car.id)).map(formatCarName);

  return (
    <div className={styles.group}>
      <div className={styles.carsRow}>
        <FormField label={texts.cars} hint={isReadOnly ? undefined : lockedNames.length > 0 ? texts.carsInUse(lockedNames.join(', ')) : texts.carsHint}>
          {(controlProps) => (
            <CarMultiPicker
              id={controlProps.id}
              aria-describedby={controlProps['aria-describedby']}
              cars={carCatalog.cars}
              group={group}
              selectedCarIds={draft.values.carIds}
              lockedCarIds={lockedCarIds}
              onToggleCar={(carId) => {
                if (draft.values.carIds.includes(carId)) {
                  if (!lockedCarIds.includes(carId)) draft.removeCar(carId);
                } else draft.addCars([carId]);
              }}
              listLabel={texts.cars}
              placeholder={carCatalog.isLoading ? messages.cars.loading : texts.carsPlaceholder}
              lockedTitle={texts.carLocked}
            removeLabel={texts.removeCar}
              disabled={isReadOnly}
              onOpen={carCatalog.refresh}
            />
          )}
        </FormField>
        {!isReadOnly && (
          <FormField label={texts.carsGroupFilter}>
            {(controlProps) => (
              <Select<CarGroup | ''>
                id={controlProps.id}
                value={group}
                options={[{ value: '', label: texts.carsAllGroups }, ...CAR_GROUPS.map((carGroup) => ({ value: carGroup, label: carGroup }))]}
                onValueChange={setGroup}
              />
            )}
          </FormField>
        )}
      </div>
      {carCatalog.errorKind && !isReadOnly && <p className={styles.rowError}>{serverErrorText(messages, carCatalog.errorKind)}</p>}
    </div>
  );
}
