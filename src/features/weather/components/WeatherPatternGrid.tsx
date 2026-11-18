import { QUALIFYING_WEATHER_SLOTS, STINT_WEATHER_SLOTS } from '@shared/weatherRules';
import type { ReactNode } from 'react';
import { useI18n } from '@/i18n/useI18n';
import styles from './WeatherPatternGrid.module.css';

/** Posizione di uno slot: riga 0 = qualifica, 1… = stint; slot da 0. */
export interface WeatherSlotPosition {
  readonly row: number;
  readonly slot: number;
  /** "Qualifica, slot 1" o "Stint 3, slot 9": nome per i lettori di schermo. */
  readonly label: string;
}

interface WeatherPatternGridProps {
  readonly stintCount: number;
  readonly renderSlot: (position: WeatherSlotPosition) => ReactNode;
}

/**
 * Righe del pattern meteo, nell'app (Crea pattern meteo) e nel sito (scheda Meteo): prima la qualifica con 2 slot,
 * poi una riga per ogni stint con 9 slot. Ogni slot lo disegna chi la usa (menu nell'app, icona e codice nel sito).
 */
export function WeatherPatternGrid({ stintCount, renderSlot }: WeatherPatternGridProps) {
  const { messages } = useI18n();
  const texts = messages.weather;
  const rows = [
    { label: texts.qualifying, slots: QUALIFYING_WEATHER_SLOTS },
    ...Array.from({ length: stintCount }, (_unused, index) => ({ label: texts.stint(index + 1), slots: STINT_WEATHER_SLOTS })),
  ];
  return (
    <div className={styles.scroller}>
      <table className={styles.grid} aria-label={texts.tableLabel}>
        <thead>
          <tr>
            <td />
            {Array.from({ length: STINT_WEATHER_SLOTS }, (_unused, slot) => (
              <th key={slot} scope="col" className={styles.slotHeader}>
                {slot + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.label} data-qualifying={rowIndex === 0 || undefined}>
              <th scope="row" className={styles.rowHeader}>
                {row.label}
              </th>
              {Array.from({ length: STINT_WEATHER_SLOTS }, (_unused, slot) => (
                <td key={slot} className={styles.slot}>
                  {slot < row.slots ? renderSlot({ row: rowIndex, slot, label: texts.slotLabel(row.label, slot + 1) }) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
