import {
  formatTrackName,
  TRACK_CONTINENT_MAX_LENGTH,
  TRACK_LENGTH_MAX_METERS,
  TRACK_NAME_MAX_LENGTH,
  type Track,
  type TrackDraft,
  toTrackKey,
  validateTrackDraft,
} from '../../../shared/raceRules';
import { parseCsvNumber } from './carCsvImport';
import { type CatalogSyncPlan, planCatalogSync } from './catalogSync';
import { findColumns, findExtraCellsProblem, type ImportProblem, parseCsv, parseCsvBoolean, readCell, toSqlNumber, toSqlText } from './csv';

/**
 * Sostituzione della tabella delle piste con un file CSV: una riga per configurazione
 * (colonne continent, track_name, configuration, length_meters, has_reverse_layout; solo il nome è obbligatorio).
 * Puro: lo script scripts/importTracks.ts legge il database e scrive l'SQL.
 */

/** Pista già nel database, con il numero di gare che la usano. */
export interface ExistingTrack extends Track {
  readonly usageCount: number;
}

export interface TrackImportPlan {
  readonly problems: readonly ImportProblem[];
  /** null se il file ha problemi: in quel caso non si scrive nulla. */
  readonly sync: CatalogSyncPlan<TrackDraft, ExistingTrack> | null;
}

const HEADER_ALIASES = {
  name: ['trackname', 'track', 'nome', 'pista', 'tracciato', 'circuito', 'nomepista', 'circuit', 'name'],
  configuration: ['configuration', 'layout', 'configurazione', 'variante', 'config'],
  continent: ['continent', 'continente', 'region', 'regione'],
  // Anche "lenght", scritto così nel primo file delle piste.
  lengthMeters: ['lengthmeters', 'length', 'lenght', 'lengthm', 'lunghezza', 'lunghezzam', 'metri', 'meters'],
  hasReverseLayout: ['hasreverselayout', 'hasreverse', 'reverse', 'reversible', 'inverso', 'sensoinverso'],
} as const;
type TrackColumn = keyof typeof HEADER_ALIASES;

const describeIssues = (issues: Partial<Record<TrackColumn, string>>, raw: Record<TrackColumn, string>) =>
  [
    issues.name && (raw.name === '' ? 'nome della pista mancante' : `nome "${raw.name}" non valido (massimo ${TRACK_NAME_MAX_LENGTH} caratteri tra lettere, numeri, spazi e . ' & ( ) / + -)`),
    issues.configuration && `configurazione "${raw.configuration}" non valida (stesse regole del nome)`,
    issues.continent && `continente "${raw.continent}" non valido (massimo ${TRACK_CONTINENT_MAX_LENGTH} caratteri)`,
    issues.lengthMeters && `lunghezza "${raw.lengthMeters}" non valida (metri, intero da 1 a ${TRACK_LENGTH_MAX_METERS}, oppure vuota)`,
    issues.hasReverseLayout && `senso inverso "${raw.hasReverseLayout}" non valido (true o false, oppure vuoto)`,
  ].filter(Boolean);

export function planTrackImport(csvText: string, existingTracks: readonly ExistingTrack[]): TrackImportPlan {
  const rows = parseCsv(csvText);
  const [firstRow] = rows;
  if (!firstRow) return { problems: [{ line: 1, message: 'il file è vuoto' }], sync: null };

  const headerColumns = findColumns(firstRow.cells, HEADER_ALIASES, ['name']);
  // Senza intestazione: un nome per riga.
  const columns = headerColumns ?? { name: 0, configuration: -1, continent: -1, lengthMeters: -1, hasReverseLayout: -1 };
  const dataRows = headerColumns ? rows.slice(1) : rows;
  if (dataRows.length === 0) return { problems: [{ line: 1, message: 'nel file non ci sono piste' }], sync: null };

  const drafts: TrackDraft[] = [];
  const problems: ImportProblem[] = [];
  const lineByKey = new Map<string, number>();

  for (const { line, cells } of dataRows) {
    const raw = Object.fromEntries(
      (Object.keys(columns) as TrackColumn[]).map((column) => [column, readCell(cells, columns[column])]),
    ) as Record<TrackColumn, string>;
    const rowLabel = raw.name ? `"${formatTrackName({ name: raw.name.trim(), configuration: raw.configuration || null })}"` : 'pista senza nome';

    const extraCellsProblem = headerColumns && findExtraCellsProblem(cells, firstRow.cells.length);
    if (extraCellsProblem) {
      problems.push({ line, message: `${rowLabel}: ${extraCellsProblem}` });
      continue;
    }

    const lengthMeters = parseCsvNumber(raw.lengthMeters);
    const hasReverseLayout = parseCsvBoolean(raw.hasReverseLayout);
    const validation = validateTrackDraft({
      name: raw.name,
      configuration: raw.configuration,
      continent: raw.continent,
      lengthMeters,
      hasReverseLayout: hasReverseLayout === undefined ? 'invalid' : hasReverseLayout,
    });
    if (!validation.isValid) {
      problems.push({ line, message: `${rowLabel}: ${describeIssues(validation.issues, raw).join('; ')}` });
      continue;
    }

    const key = toTrackKey(validation.track);
    const previousLine = lineByKey.get(key);
    if (previousLine !== undefined) {
      problems.push({ line, message: `"${formatTrackName(validation.track)}": pista già presente alla riga ${previousLine}` });
      continue;
    }
    lineByKey.set(key, line);
    drafts.push(validation.track);
  }

  if (problems.length > 0) return { problems, sync: null };

  const sync = planCatalogSync(drafts, existingTracks, toTrackKey, toTrackKey, (existing, unmatchedDrafts) => {
    // Una pista salvata senza configurazione ("Monza") diventa quella del file se il file ne ha una sola con quel nome.
    if (existing.configuration !== null) return undefined;
    const sameName = unmatchedDrafts.filter((draft) => draft.name.toLowerCase() === existing.name.toLowerCase());
    return sameName.length === 1 ? sameName[0] : undefined;
  });
  return { problems: [], sync };
}

const toSqlBoolean = (value: boolean | null) => (value === null ? 'NULL' : value ? '1' : '0');

/** Prima le eliminazioni, poi gli aggiornamenti, infine le piste nuove. */
export function buildTrackSyncSql(sync: CatalogSyncPlan<TrackDraft, ExistingTrack>): string {
  const values = (track: TrackDraft) => ({
    name: toSqlText(track.name),
    nameKey: toSqlText(toTrackKey(track)),
    configuration: toSqlText(track.configuration),
    continent: toSqlText(track.continent),
    lengthMeters: toSqlNumber(track.lengthMeters),
    hasReverseLayout: toSqlBoolean(track.hasReverseLayout),
  });
  const statements: string[] = [];
  if (sync.deletes.length > 0) statements.push(`DELETE FROM tracks WHERE id IN (${sync.deletes.map((track) => track.id).join(', ')});`);
  for (const { existing, draft } of sync.updates) {
    const sql = values(draft);
    statements.push(
      `UPDATE tracks SET name = ${sql.name}, name_key = ${sql.nameKey}, configuration = ${sql.configuration}, continent = ${sql.continent}, length_meters = ${sql.lengthMeters}, has_reverse_layout = ${sql.hasReverseLayout} WHERE id = ${existing.id};`,
    );
  }
  for (const draft of sync.inserts) {
    const sql = values(draft);
    statements.push(
      `INSERT INTO tracks (name, name_key, configuration, continent, length_meters, has_reverse_layout) VALUES (${sql.name}, ${sql.nameKey}, ${sql.configuration}, ${sql.continent}, ${sql.lengthMeters}, ${sql.hasReverseLayout});`,
    );
  }
  return statements.join('\n');
}
