/**
 * Lettura dei file CSV comune a tutte le importazioni (equipaggi, auto, piste).
 * Puro: niente file né rete, così è testabile.
 */

const SUPPORTED_DELIMITERS = [';', ',', '\t'] as const;

/** Problema in una riga del file. */
export interface ImportProblem {
  /** Riga del file (1 = prima riga), per ritrovarla subito nell'editor o in Excel. */
  readonly line: number;
  readonly message: string;
}

/** Intestazioni confrontate in minuscolo, senza spazi, punti, trattini e accenti. */
export const normalizeHeader = (header: string): string =>
  header
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s._-]/g, '');

/** Excel in italiano salva con ";", altri programmi con "," o tabulazione: vince il più presente nella prima riga. */
function detectDelimiter(firstLine: string): string {
  const countOccurrences = (delimiter: string) => firstLine.split(delimiter).length - 1;
  return SUPPORTED_DELIMITERS.reduce((best, candidate) =>
    countOccurrences(candidate) > countOccurrences(best) ? candidate : best,
  );
}

export interface CsvRow {
  readonly line: number;
  readonly cells: readonly string[];
}

/** Lettore CSV (RFC 4180): virgolette, separatori e a capo dentro le virgolette, BOM di Excel, righe vuote ignorate. */
export function parseCsv(csvText: string): CsvRow[] {
  const text = csvText.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] ?? '');
  const rows: CsvRow[] = [];

  let cells: string[] = [];
  let currentCell = '';
  let isInsideQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const finishRow = () => {
    cells.push(currentCell);
    if (cells.some((cell) => cell.trim() !== '')) rows.push({ line: rowStartLine, cells });
    cells = [];
    currentCell = '';
  };

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (isInsideQuotes) {
      if (character === '"' && text[index + 1] === '"') {
        currentCell += '"';
        index++;
      } else if (character === '"') {
        isInsideQuotes = false;
      } else {
        if (character === '\n') line++;
        currentCell += character;
      }
    } else if (character === '"') {
      isInsideQuotes = true;
    } else if (character === delimiter) {
      cells.push(currentCell);
      currentCell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      finishRow();
      line++;
      rowStartLine = line;
    } else {
      currentCell += character;
    }
  }
  if (currentCell !== '' || cells.length > 0) finishRow();
  return rows;
}

export const readCell = (cells: readonly string[], position: number): string =>
  (position >= 0 ? (cells[position] ?? '') : '').trim();

/**
 * Posizione di ogni colonna cercando la prima riga tra gli alias; null se la prima riga non è
 * un'intestazione (manca una colonna obbligatoria). -1 = colonna facoltativa assente.
 */
export function findColumns<Column extends string>(
  headerCells: readonly string[],
  aliases: Readonly<Record<Column, readonly string[]>>,
  requiredColumns: readonly NoInfer<Column>[],
): Record<Column, number> | null {
  const normalizedHeaders = headerCells.map(normalizeHeader);
  const positions = Object.fromEntries(
    (Object.keys(aliases) as Column[]).map((column) => [column, normalizedHeaders.findIndex((header) => aliases[column].includes(header))]),
  ) as Record<Column, number>;
  return requiredColumns.every((column) => positions[column] >= 0) ? positions : null;
}

/**
 * Una riga con valori oltre l'ultima colonna dell'intestazione di solito ha un ";" al posto della
 * virgola decimale ("95;5" invece di "95,5"): meglio fermarsi che leggere i numeri spostati.
 */
export function findExtraCellsProblem(cells: readonly string[], columnCount: number): string | undefined {
  const extraValues = cells.slice(columnCount).filter((cell) => cell.trim() !== '');
  return extraValues.length > 0
    ? `la riga ha ${extraValues.length === 1 ? 'un valore' : `${extraValues.length} valori`} in più rispetto alle ${columnCount} colonne (${extraValues.map((value) => `"${value.trim()}"`).join(', ')}): forse un ";" al posto della virgola decimale`
    : undefined;
}

/** "true", "sì", "yes", "1", "vero" → true; "false", "no", "0", "falso" → false; vuoto → null; altro → undefined. */
export function parseCsvBoolean(rawValue: string): boolean | null | undefined {
  const value = normalizeHeader(rawValue);
  if (value === '') return null;
  if (['true', 'si', 'yes', '1', 'vero', 'x'].includes(value)) return true;
  if (['false', 'no', '0', 'falso'].includes(value)) return false;
  return undefined;
}

/** Valore SQL di testo (o NULL), con gli apici raddoppiati. */
export const toSqlText = (value: string | null): string => (value === null ? 'NULL' : `'${value.replaceAll("'", "''")}'`);

/** Valore SQL numerico (o NULL). */
export const toSqlNumber = (value: number | null): string => (value === null ? 'NULL' : String(value));

/**
 * "1.250" (migliaia all'italiana) → 1250; "95,5" o "95.5" → 95.5; "20%" → 20; vuoto → null.
 * Qualsiasi altra cosa → NaN, che la convalida rifiuta.
 */
export function parseCsvNumber(rawValue: string): number | null {
  const text = rawValue.replace(/\s/g, '').replace(/%$/, '');
  if (text === '') return null;
  const normalized = /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replaceAll('.', '') : text.replace(',', '.');
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}
