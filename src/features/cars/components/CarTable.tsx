import { type Car, CAR_GROUPS, type CarGroup, formatCarName } from '@shared/carRules';
import { useState } from 'react';
import { CatalogTable } from '@/components/data-table/CatalogTable';
import { MissingValue } from '@/components/data-table/MissingValue';
import { FormField } from '@/components/form/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { useI18n } from '@/i18n/useI18n';
import styles from '../ManageCarsPage.module.css';

const COLUMNS = ['manufacturer', 'model', 'group', 'horsepower', 'weightKg', 'drivetrain', 'bopHorsepower', 'bopWeightKg', 'limiter', 'ballastKg'] as const;
const NUMBER_COLUMNS = new Set<string>(['horsepower', 'weightKg', 'bopHorsepower', 'bopWeightKg', 'limiter', 'ballastKg']);

/** Ordine della tabella: per gruppo (Gr.1 → Gr.4, poi senza gruppo), poi costruttore e modello. */
function sortCars(cars: readonly Car[], locale: string): Car[] {
  const groupOrder = (car: Car) => (car.group ? CAR_GROUPS.indexOf(car.group) : CAR_GROUPS.length);
  return [...cars].sort((first, second) => groupOrder(first) - groupOrder(second) || formatCarName(first).localeCompare(formatCarName(second), locale));
}

/** Tabella delle vetture con ricerca per nome e filtro per gruppo. */
export function CarTable({ cars }: { readonly cars: readonly Car[] }) {
  const { locale, messages, formatDecimal, formatSignedDecimal } = useI18n();
  const texts = messages.cars.manage;
  const [searchText, setSearchText] = useState('');
  const [group, setGroup] = useState<CarGroup | ''>('');
  const search = searchText.trim().toLowerCase();
  const shownCars = sortCars(cars, locale).filter(
    (car) => (group === '' || car.group === group) && (search === '' || formatCarName(car).toLowerCase().includes(search)),
  );

  const cellValue = (car: Car, column: (typeof COLUMNS)[number]) => {
    const value = car[column];
    if (value === null) return <MissingValue />;
    if (column === 'limiter') return `${formatDecimal(value as number)}%`;
    if (column === 'ballastKg') return `${formatSignedDecimal(value as number)} kg`;
    return typeof value === 'number' ? formatDecimal(value) : value;
  };

  return (
    <div className={styles.carTable}>
      <div className={styles.filters} role="search">
        <FormField label={texts.searchLabel}>
          {(controlProps) => <Input id={controlProps.id} type="text" spellCheck={false} placeholder={texts.searchPlaceholder} value={searchText} onValueChange={setSearchText} />}
        </FormField>
        <FormField label={texts.groupFilter}>
          {(controlProps) => (
            <Select<CarGroup | ''>
              id={controlProps.id}
              value={group}
              options={[{ value: '', label: texts.allGroups }, ...CAR_GROUPS.map((carGroup) => ({ value: carGroup, label: carGroup }))]}
              onValueChange={setGroup}
            />
          )}
        </FormField>
      </div>
      <CatalogTable
        rows={shownCars}
        totalCount={cars.length}
        rowKey={(car) => car.id}
        columns={COLUMNS.map((column) => ({ key: column, header: texts.columns[column], isNumber: NUMBER_COLUMNS.has(column), render: (car: Car) => cellValue(car, column) }))}
        texts={texts}
      />
    </div>
  );
}
