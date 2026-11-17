import { formatCarName } from '@shared/carRules';
import { FormField } from '@/components/form/FormField/FormField';
import { useCarCatalog } from '@/features/cars/useCarCatalog';
import { useI18n } from '@/i18n/useI18n';
import type { ChampionshipDraftState } from '../../hooks/useChampionshipDraft';
import styles from '../ChampionshipFields/ChampionshipFields.module.css';
import { CarMultiPicker } from './CarMultiPicker';

interface ChampionshipCarsFieldProps {
  readonly draft: ChampionshipDraftState;
  readonly isReadOnly: boolean;
  /** Vetture usate da almeno un equipaggio del campionato: non si possono togliere. */
  readonly lockedCarIds: readonly number[];
}

/** Vetture ammesse, scelte dal catalogo delle auto con le caselle di spunta e mostrate come clip. */
export function ChampionshipCarsField({ draft, isReadOnly, lockedCarIds }: ChampionshipCarsFieldProps) {
  const { messages } = useI18n();
  const texts = messages.championships;
  const carCatalog = useCarCatalog();
  const lockedNames = carCatalog.cars.filter((car) => lockedCarIds.includes(car.id) && draft.values.carIds.includes(car.id)).map(formatCarName);

  return (
    <div className={styles.group}>
      <FormField label={texts.cars} hint={isReadOnly ? undefined : lockedNames.length > 0 ? texts.carsInUse(lockedNames.join(', ')) : texts.carsHint}>
        {(controlProps) => (
          <CarMultiPicker
            id={controlProps.id}
            aria-describedby={controlProps['aria-describedby']}
            cars={carCatalog.cars}
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
            disabled={isReadOnly}
            onOpen={carCatalog.refresh}
          />
        )}
      </FormField>
      {carCatalog.errorKind && !isReadOnly && <p className={styles.rowError}>{messages.serverErrors[carCatalog.errorKind]}</p>}
    </div>
  );
}
