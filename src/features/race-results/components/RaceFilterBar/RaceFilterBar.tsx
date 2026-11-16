import { CREW_CHAMPIONSHIPS } from '@shared/crewRules';
import { FormField } from '@/components/form/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { useI18n } from '@/i18n/useI18n';
import type { RaceFilters, RaceTrackOption } from '../../model/raceList';
import styles from './RaceFilterBar.module.css';

interface RaceFilterBarProps {
  readonly filters: RaceFilters;
  readonly onFiltersChange: (filters: RaceFilters) => void;
  /** Piste presenti nelle gare (vedi listRaceTrackOptions); senza piste il filtro resta disattivato. */
  readonly trackOptions: readonly RaceTrackOption[];
}

/** Campionato, tracciato (per ora disattivato) e intervallo di date, con i calendari nativi. */
export function RaceFilterBar({ filters, onFiltersChange, trackOptions }: RaceFilterBarProps) {
  const { messages } = useI18n();
  const listTexts = messages.races.list;

  const championshipOptions: { value: RaceFilters['championship']; label: string }[] = [
    { value: '', label: listTexts.allChampionships },
    ...CREW_CHAMPIONSHIPS.map((championship) => ({ value: championship, label: championship })),
  ];

  return (
    <div className={styles.raceFilterBar} role="search">
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
      <FormField label={listTexts.trackFilterLabel}>
        {(controlProps) => (
          <Select
            id={controlProps.id}
            disabled={trackOptions.length === 0}
            value={filters.trackId}
            options={[{ value: '', label: listTexts.allTracks }, ...trackOptions]}
            onValueChange={(trackId) => {
              onFiltersChange({ ...filters, trackId });
            }}
          />
        )}
      </FormField>
      <FormField label={listTexts.fromDateLabel}>
        {(controlProps) => (
          <Input
            id={controlProps.id}
            type="date"
            max={filters.toDate || undefined}
            value={filters.fromDate}
            onValueChange={(fromDate) => {
              onFiltersChange({ ...filters, fromDate });
            }}
          />
        )}
      </FormField>
      <FormField label={listTexts.toDateLabel}>
        {(controlProps) => (
          <Input
            id={controlProps.id}
            type="date"
            min={filters.fromDate || undefined}
            value={filters.toDate}
            onValueChange={(toDate) => {
              onFiltersChange({ ...filters, toDate });
            }}
          />
        )}
      </FormField>
    </div>
  );
}
