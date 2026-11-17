import { formatCarName } from '@shared/carRules';
import { findChampionship } from '@shared/championshipRules';
import type { CrewChampionship } from '@shared/crewRules';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Select } from '@/components/ui/Select/Select';
import { useCarCatalog } from '@/features/cars/useCarCatalog';
import { useChampionships } from '@/features/championships/useChampionships';
import { useI18n } from '@/i18n/useI18n';
import { CREW_FORM_FIELDS } from '../../crewFormFields';
import { type CrewDraftState, toCrewChampionships } from '../../hooks/useCrewDraft';
import styles from './CrewChampionshipsField.module.css';

interface CrewChampionshipsFieldProps {
  readonly draft: CrewDraftState;
  readonly isReadOnly: boolean;
}

/**
 * Campionati dell'equipaggio: una riga per campionato, con l'auto scelta tra quelle disponibili in quel campionato
 * e la X per togliere il campionato; sotto, il menu per aggiungerne un altro. Anche nessun campionato va bene.
 * I campionati vanno al form anche come campo nascosto (JSON), letto da "Aggiungi equipaggio".
 */
export function CrewChampionshipsField({ draft, isReadOnly }: CrewChampionshipsFieldProps) {
  const { messages } = useI18n();
  const texts = messages.crews;
  // Le auto arrivano dal server: lette all'apertura e di nuovo a ogni interazione con un menu.
  const carCatalog = useCarCatalog();
  // Anche i campionati: quelli creati in "Gestione campionati", con le loro vetture ammesse.
  const championshipCatalog = useChampionships();
  const { championships } = draft.values;
  const availableChampionships = championshipCatalog.championships
    .map(({ name }) => name)
    .filter((name) => !championships.some((entry) => entry.championship === name));

  const carPlaceholder = (carId: string) => {
    if (carCatalog.isLoading) return messages.cars.loading;
    if (carId !== '' && !carCatalog.carNameById.has(Number(carId))) return messages.cars.unknownCar;
    return isReadOnly ? texts.missingCar : texts.carPlaceholder;
  };

  return (
    <fieldset className={styles.championships}>
      <legend className={styles.legend}>{texts.championships}</legend>
      {!isReadOnly && <p className={styles.hint}>{texts.championshipsHint}</p>}
      <input type="hidden" name={CREW_FORM_FIELDS.championships} value={JSON.stringify(toCrewChampionships(championships))} />

      {championships.length === 0 ? (
        <p className={styles.empty}>{texts.noChampionships}</p>
      ) : (
        <ul className={styles.list}>
          {championships.map(({ championship, carId }) => {
            // Solo le vetture ammesse in quel campionato.
            const cars = carCatalog.cars.filter((car) => car.championships.includes(championship));
            const isCarListed = cars.some((car) => String(car.id) === carId);
            return (
              <li key={championship} className={styles.row}>
                <span className={styles.championshipName}>{championship}</span>
                <Select
                  aria-label={texts.carIn(championship)}
                  disabled={isReadOnly}
                  placeholderLabel={cars.length === 0 && !carCatalog.isLoading ? texts.noCarsInChampionship : carPlaceholder(carId)}
                  value={carCatalog.isLoading || !isCarListed ? '' : carId}
                  options={cars.map((car) => ({ value: String(car.id), label: formatCarName(car) }))}
                  onValueChange={(nextCarId) => draft.changeChampionshipCar(championship, nextCarId)}
                  onFocus={carCatalog.refresh}
                />
                {!isReadOnly && (
                  <IconButton
                    accessibleLabel={texts.removeChampionship(championship)}
                    title={texts.removeChampionship(championship)}
                    className={styles.removeButton}
                    onClick={() => draft.removeChampionship(championship)}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="m3.5 3.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </IconButton>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!isReadOnly && availableChampionships.length > 0 && (
        <Select<CrewChampionship | ''>
          aria-label={texts.addChampionship}
          placeholderLabel={texts.addChampionship}
          value=""
          options={availableChampionships.map((championship) => ({ value: championship, label: championship }))}
          onValueChange={(championship) => {
            const name = findChampionship(championshipCatalog.championships, championship)?.name;
            if (name) draft.addChampionship(name);
          }}
          onFocus={championshipCatalog.refresh}
        />
      )}
      {carCatalog.errorKind && !isReadOnly && <p className={styles.error}>{messages.serverErrors[carCatalog.errorKind]}</p>}
      {championshipCatalog.errorKind && !isReadOnly && <p className={styles.error}>{messages.serverErrors[championshipCatalog.errorKind]}</p>}
    </fieldset>
  );
}
