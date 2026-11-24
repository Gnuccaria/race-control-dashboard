import { formatLapTime, type PublicQualifyingResult } from '@shared/qualifyingRules';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { ColorDot } from '@/components/ui/ColorDot/ColorDot';
import { useI18n } from '@/i18n/useI18n';
import { joinClassNames } from '@/lib/joinClassNames';
import styles from '../ClassificationTable/ClassificationTable.module.css';

type ColumnKey = 'position' | 'number' | 'crew' | 'car' | 'q1' | 'q2';
const COLUMNS: readonly ColumnKey[] = ['position', 'number', 'crew', 'car', 'q1', 'q2'];
const NUMERIC_COLUMNS = new Set<ColumnKey>(['number', 'q1', 'q2']);

/**
 * Qualifiche di una gara, con lo stesso aspetto della classifica: posizione, numero, equipaggio, vettura e miglior giro
 * in Q1 e in Q2 (M:SS.DDD; il Q2 c'è solo nelle posizioni 1–4 e 8–11).
 */
export function QualifyingTable({ results }: { readonly results: readonly PublicQualifyingResult[] }) {
  const { messages } = useI18n();
  const texts = messages.site.qualifying;
  const missing = <span className={tableStyles.missingValue}>–</span>;

  return (
    <div className={tableStyles.tableScroller}>
      <table className={joinClassNames(tableStyles.dataTable, styles.classificationTable)} aria-label={texts.tableLabel}>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={joinClassNames(tableStyles.plainColumnHeader, NUMERIC_COLUMNS.has(column) && styles.numeric)}>
                {column === 'q1' || column === 'q2' ? texts[column] : messages.site.classification[column]}
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
              <td className={joinClassNames(styles.numeric, styles.gap)}>{result.q1Ms === null ? missing : formatLapTime(result.q1Ms)}</td>
              <td className={joinClassNames(styles.numeric, styles.gap)}>{result.q2Ms === null ? missing : formatLapTime(result.q2Ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
