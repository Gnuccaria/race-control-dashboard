import { type Car, CAR_GROUPS, type CarGroup, formatCarName } from '@shared/carRules';
import { useState } from 'react';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { EmptyState } from '@/components/data-table/ListStatus';
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
    if (value === null) return <span className={tableStyles.missingValue}>–</span>;
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
      <div className={tableStyles.tableCaption}>
        <p aria-live="polite">{texts.count(shownCars.length, cars.length)}</p>
      </div>
      {shownCars.length === 0 ? (
        <EmptyState title={cars.length === 0 ? texts.emptyTitle : texts.noMatches} description={cars.length === 0 ? texts.emptyDescription : undefined} />
      ) : (
        <div className={tableStyles.tableScroller}>
          <table className={tableStyles.dataTable} aria-label={texts.tableLabel}>
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col" className={tableStyles.plainColumnHeader}>
                    {texts.columns[column]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shownCars.map((car) => (
                <tr key={car.id} className={tableStyles.dataRow}>
                  {COLUMNS.map((column) => (
                    <td key={column} className={NUMBER_COLUMNS.has(column) ? tableStyles.numberCell : undefined}>
                      {cellValue(car, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
