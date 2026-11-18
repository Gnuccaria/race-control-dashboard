import type { PublicRaceResult } from '@shared/raceRules';
import { formatGap } from '@shared/raceRules';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { ColorDot } from '@/components/ui/ColorDot/ColorDot';
import { useI18n } from '@/i18n/useI18n';
import { joinClassNames } from '@/lib/joinClassNames';
import { computeLapsBehind } from '../../model/lapsBehind';
import styles from './ClassificationTable.module.css';

type ColumnKey = 'position' | 'number' | 'crew' | 'car' | 'laps' | 'gap' | 'penalties';
const COLUMNS: readonly ColumnKey[] = ['position', 'number', 'crew', 'car', 'laps', 'gap', 'penalties'];
/** Colonne numeriche: allineate a destra con cifre della stessa larghezza. */
const NUMERIC_COLUMNS = new Set<ColumnKey>(['number', 'laps', 'gap', 'penalties']);

/**
 * Classifica di una gara: posizione, numero, equipaggio, vettura, giri completati, distacco e penalità.
 * Distacco: il tempo inserito nell'app; se manca, i giri in meno rispetto al primo ("+ 2 giri"). Il primo non ne ha.
 */
export function ClassificationTable({ results }: { readonly results: readonly PublicRaceResult[] }) {
  const { messages, decimalSeparator } = useI18n();
  const texts = messages.site.classification;
  const missing = <span className={tableStyles.missingValue}>–</span>;
  const leader = results[0];

  const renderGap = (result: PublicRaceResult) => {
    if (result === leader) return missing;
    if (result.gapMs !== null) return `+${formatGap(result.gapMs, decimalSeparator)}`;
    const lapsBehind = computeLapsBehind(leader?.laps ?? null, result.laps);
    return lapsBehind === null ? missing : texts.lapsBehind(lapsBehind);
  };

  return (
    <div className={tableStyles.tableScroller}>
      <table className={joinClassNames(tableStyles.dataTable, styles.classificationTable)} aria-label={texts.tableLabel}>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={joinClassNames(tableStyles.plainColumnHeader, NUMERIC_COLUMNS.has(column) && styles.numeric)}>
                {texts[column]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.position} className={tableStyles.dataRow} data-podium={result.position <= 3 ? result.position : undefined}>
              <td className={styles.position}>{result.position}</td>
              <td className={styles.numeric}>{result.crewNumber}</td>
              <td>
                <span className={styles.crew}>
                  <ColorDot color={result.crewColor} size="small" />
                  {result.crewName}
                </span>
              </td>
              <td>{result.carName ?? missing}</td>
              <td className={styles.numeric}>{result.laps ?? missing}</td>
              <td className={joinClassNames(styles.numeric, styles.gap)}>
                {renderGap(result)}
              </td>
              {/* Penalità totali come nel referto: decisioni a tempo + cambi pilota (secondi per eccesso). */}
              <td className={joinClassNames(styles.numeric, styles.gap)}>{result.penaltyMs === null ? missing : `+${formatGap(result.penaltyMs, decimalSeparator)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
