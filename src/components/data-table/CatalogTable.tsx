import type { ReactNode } from 'react';
import tableStyles from './DataTable.module.css';
import { EmptyState } from './ListStatus';

export interface CatalogColumn<Row> {
  readonly key: string;
  readonly header: string;
  /** Numeri allineati a destra. */
  readonly isNumber?: boolean;
  readonly render: (row: Row) => ReactNode;
}

export interface CatalogTableTexts {
  readonly tableLabel: string;
  /** «12 di 240 vetture». */
  readonly count: (shownCount: number, totalCount: number) => string;
  readonly emptyTitle: string;
  readonly emptyDescription: string;
  readonly noMatches: string;
}

interface CatalogTableProps<Row> {
  /** Righe già filtrate e ordinate. */
  readonly rows: readonly Row[];
  /** Quante righe ci sono senza filtri: per il conteggio e per distinguere «elenco vuoto» da «nessun risultato». */
  readonly totalCount: number;
  readonly rowKey: (row: Row) => string | number;
  readonly columns: readonly CatalogColumn<Row>[];
  readonly texts: CatalogTableTexts;
}

/**
 * Tabella in sola lettura di un catalogo (vetture, tracciati): conteggio delle righe mostrate, stato vuoto (catalogo
 * vuoto o nessun risultato con i filtri) e tabella con intestazioni semplici. I filtri li mette chi la usa, sopra.
 */
export function CatalogTable<Row>({ rows, totalCount, rowKey, columns, texts }: CatalogTableProps<Row>) {
  return (
    <>
      <div className={tableStyles.tableCaption}>
        <p aria-live="polite">{texts.count(rows.length, totalCount)}</p>
      </div>
      {rows.length === 0 ? (
        <EmptyState title={totalCount === 0 ? texts.emptyTitle : texts.noMatches} description={totalCount === 0 ? texts.emptyDescription : undefined} />
      ) : (
        <div className={tableStyles.tableScroller}>
          <table className={tableStyles.dataTable} aria-label={texts.tableLabel}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className={tableStyles.plainColumnHeader}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)} className={tableStyles.dataRow}>
                  {columns.map((column) => (
                    <td key={column.key} className={column.isNumber ? tableStyles.numberCell : undefined}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
