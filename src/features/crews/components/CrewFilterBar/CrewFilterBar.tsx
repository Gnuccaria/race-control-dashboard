import { CREW_CHAMPIONSHIPS } from '@shared/crewRules';
import { FormField } from '@/components/form/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import type { CarCatalog } from '@/features/cars/useCarCatalog';
import { useI18n } from '@/i18n/useI18n';
import { type CrewFilters, MISSING_VALUE_FILTER } from '../../model/crewList';
import styles from './CrewFilterBar.module.css';

interface CrewFilterBarProps {
  readonly filters: CrewFilters;
  readonly onFiltersChange: (filters: CrewFilters) => void;
  readonly carCatalog: CarCatalog;
}

/** Ricerca per numero o nome (si aggiorna a ogni carattere) e filtri per auto e campionato. */
export function CrewFilterBar({ filters, onFiltersChange, carCatalog }: CrewFilterBarProps) {
  const { messages } = useI18n();
  const listTexts = messages.crews.list;

  const carOptions: { value: string; label: string }[] = [
    { value: '', label: listTexts.allCars },
    ...carCatalog.cars.map((car) => ({ value: String(car.id), label: carCatalog.carNameById.get(car.id) ?? '' })),
    { value: MISSING_VALUE_FILTER, label: listTexts.missingCarOption },
  ];
  const championshipOptions: { value: CrewFilters['championship']; label: string }[] = [
    { value: '', label: listTexts.allChampionships },
    ...CREW_CHAMPIONSHIPS.map((championship) => ({ value: championship, label: championship })),
    // Equipaggi che non partecipano a nessun campionato.
    { value: MISSING_VALUE_FILTER, label: messages.crews.noChampionships },
  ];

  return (
    <div className={styles.crewFilterBar} role="search">
      <FormField label={listTexts.searchLabel}>
        {(controlProps) => (
          <Input
            id={controlProps.id}
            type="text"
            spellCheck={false}
            placeholder={listTexts.searchPlaceholder}
            value={filters.searchText}
            onValueChange={(searchText) => {
              onFiltersChange({ ...filters, searchText });
            }}
          />
        )}
      </FormField>
      <FormField label={listTexts.carFilterLabel}>
        {(controlProps) => (
          <Select
            id={controlProps.id}
            value={filters.carId}
            options={carOptions}
            onValueChange={(carId) => {
              onFiltersChange({ ...filters, carId });
            }}
            onFocus={carCatalog.refresh}
          />
        )}
      </FormField>
      <FormField label={listTexts.championshipFilterLabel}>
        {(controlProps) => (
          <Select
            id={controlProps.id}
            value={filters.championship}
            options={championshipOptions}
            onValueChange={(championship) => {
              onFiltersChange({ ...filters, championship });
            }}
          />
        )}
      </FormField>
    </div>
  );
}
