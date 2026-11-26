import tableStyles from './DataTable.module.css';

/** Valore mancante in una cella: un trattino attenuato, o il testo indicato («Nessuna auto»). */
export function MissingValue({ children = '–' }: { readonly children?: string }) {
  return <span className={tableStyles.missingValue}>{children}</span>;
}
