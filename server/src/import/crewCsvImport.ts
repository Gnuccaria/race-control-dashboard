import {
  type CrewDraft,
  CHAMPIONSHIP_FORMER_NAMES,
  type CrewChampionship,
  type CrewChampionshipEntry,
  CREW_NAME_MAX_LENGTH,
  sortCrewChampionships,
  toCrewNameKey,
  validateCrewDraft,
} from '../../../shared/crewRules';
import { type Car, formatCarName } from '../../../shared/carRules';
import { findExtraCellsProblem, type ImportProblem, normalizeHeader, parseCsv, readCell, toSqlText } from './csv';

export { parseCsv };

/** Auto conosciute dal database: le auto del CSV vengono cercate per nome qui dentro, tra quelle del campionato. */
export type ImportableCar = Pick<Car, 'id' | 'manufacturer' | 'model' | 'championships'>;

/**
 * Cosa fa una riga ai campionati di un equipaggio già salvato:
 * - merge: aggiunge (o aggiorna) il campionato della riga, con la sua auto, e tiene gli altri;
 * - keep: campionato vuoto nel file, restano quelli salvati;
 * - clear: "Nessuno", l'equipaggio esce da tutti i campionati.
 */
export type ChampionshipMode = 'merge' | 'keep' | 'clear';

/**
 * Importazione di equipaggi da CSV: lettura del file, controllo di ogni riga con le stesse
 * regole dell'app e del server, ricerca dei duplicati e preparazione dell'SQL.
 * Tutto puro (niente file né rete), così è testabile; lo script scripts/importCrews.ts fa il resto.
 */

export type CrewImportProblem = ImportProblem;

export interface CrewImportPlan {
  /** Ogni riga ha al massimo un campionato (con la sua auto). */
  readonly crews: readonly CrewDraft[];
  /** Riga del file di ogni equipaggio (stesso ordine di crews). */
  readonly lines: readonly number[];
  /** Cosa fa ogni riga ai campionati già salvati (stesso ordine di crews). */
  readonly championshipModes: readonly ChampionshipMode[];
  readonly problems: readonly CrewImportProblem[];
}

/** Equipaggio già nel database, con il numero di ordini di arrivo in cui compare. */
export interface ExistingCrew {
  readonly id: number;
  readonly name: string;
  readonly number: number;
  readonly championships: readonly CrewChampionshipEntry[];
  readonly color: string | null;
  readonly usageCount: number;
}

export interface CrewSyncPlan {
  readonly problems: readonly CrewImportProblem[];
  readonly inserts: readonly CrewDraft[];
  /** draft = dati finali: colore vuoto nel file resta quello salvato; campionati secondo ChampionshipMode. */
  readonly updates: readonly { readonly existing: ExistingCrew; readonly draft: CrewDraft }[];
  readonly deletes: readonly ExistingCrew[];
  /** Assenti dal file ma presenti in qualche ordine di arrivo: restano. */
  readonly kept: readonly ExistingCrew[];
}

/** Intestazioni riconosciute (confrontate in minuscolo, senza spazi, punti e accenti). */
const HEADER_ALIASES = {
  name: ['nome', 'nomeequipaggio', 'equipaggio', 'team', 'nometeam', 'name', 'crew', 'crewname', 'teamname'],
  number: ['numero', 'numeroequipaggio', 'n', 'nr', 'num', '#', 'number', 'crewnumber', 'carnumber'],
  car: ['auto', 'macchina', 'vettura', 'modello', 'car', 'marca', 'brand', 'carname'],
  championship: ['campionato', 'championship', 'serie', 'series', 'categoria', 'league', 'lega'],
  color: ['colore', 'color', 'colour', 'hex', 'colorehex', 'crewcolor', 'liverycolor'],
} as const;

type CrewColumn = keyof typeof HEADER_ALIASES;
/** Posizione di ogni colonna; -1 = colonna assente (ammesso solo per auto, campionato e colore). */
type ColumnPositions = Record<CrewColumn, number>;

/** Ordine usato quando il file non ha una riga di intestazione. */
const DEFAULT_COLUMN_POSITIONS: ColumnPositions = { name: 0, number: 1, car: 2, championship: 3, color: 4 };

/** Trova le colonne dall'intestazione; null se la prima riga non è un'intestazione (servono almeno nome e numero). */
function findColumnPositions(headerCells: readonly string[]): ColumnPositions | null {
  const normalizedHeaders = headerCells.map(normalizeHeader);
  const findColumn = (column: CrewColumn) =>
    normalizedHeaders.findIndex((header) => (HEADER_ALIASES[column] as readonly string[]).includes(header));

  const positions: ColumnPositions = {
    name: findColumn('name'),
    number: findColumn('number'),
    car: findColumn('car'),
    championship: findColumn('championship'),
    color: findColumn('color'),
  };
  return positions.name >= 0 && positions.number >= 0 ? positions : null;
}

/** "ferrari", " FERRARI " → "Ferrari": l'auto si riconosce senza badare a maiuscole e spazi. */
/** "ferrari", " FERRARI " → l'auto "Ferrari" del database; vale anche "Porsche 911 GT3 R" con il modello. */
const findCarId = (rawCar: string, cars: readonly ImportableCar[]): number | undefined => {
  const carKey = rawCar.trim().replace(/\s+/g, ' ').toLowerCase();
  return cars.find((car) => formatCarName(car).toLowerCase() === carKey)?.id;
};

/** Scritte che nel file indicano "nessun campionato". */
const NO_CHAMPIONSHIP_ALIASES = ['none', 'nessuno', 'nessun campionato'];

/** Stesso principio per il campionato, che si riconosce anche con il nome precedente ("FIE Cool1") o come "Nessuno". */
function matchCrewChampionship(rawChampionship: string, championships: readonly string[]): CrewChampionship | 'none' | undefined {
  const championshipKey = rawChampionship.trim().replace(/\s+/g, ' ').toLowerCase();
  if (NO_CHAMPIONSHIP_ALIASES.includes(championshipKey)) return 'none';
  const formerName = CHAMPIONSHIP_FORMER_NAMES[championshipKey]?.toLowerCase();
  return championships.find((championship) => championship.toLowerCase() === championshipKey || championship.toLowerCase() === formerName);
}

const NAME_ISSUE_MESSAGES = {
  required: 'nome mancante',
  'invalid-characters': 'il nome può contenere solo lettere, numeri e spazi tra le parole',
  'too-long': `il nome supera i ${CREW_NAME_MAX_LENGTH} caratteri`,
} as const;

/** Controlla tutto il file prima di scrivere qualsiasi cosa: dati non validi e duplicati dentro il file. */
/** championships = nomi dei campionati creati nell'app (tabella championships). */
export function planCrewImport(csvText: string, cars: readonly ImportableCar[], championships: readonly string[]): CrewImportPlan {
  const rows = parseCsv(csvText);
  const [firstRow] = rows;
  if (!firstRow) return { crews: [], lines: [], championshipModes: [], problems: [{ line: 1, message: 'il file è vuoto' }] };

  const headerPositions = findColumnPositions(firstRow.cells);
  const columnPositions = headerPositions ?? DEFAULT_COLUMN_POSITIONS;
  const dataRows = headerPositions ? rows.slice(1) : rows;

  const crews: CrewDraft[] = [];
  const lines: number[] = [];
  const championshipModes: ChampionshipMode[] = [];
  const problems: CrewImportProblem[] = [];
  const lineByNumber = new Map<number, number>();
  const lineByNameKey = new Map<string, number>();

  for (const { line, cells } of dataRows) {
    const rawName = readCell(cells, columnPositions.name);
    // "#46" e "46" sono lo stesso numero.
    const rawNumber = readCell(cells, columnPositions.number).replace(/^#/, '');
    const rawCar = readCell(cells, columnPositions.car);
    const rawChampionship = readCell(cells, columnPositions.championship);
    const rawColor = readCell(cells, columnPositions.color);
    const rowLabel = rawName || `numero ${rawNumber || '?'}`;
    const extraCellsProblem = headerPositions && findExtraCellsProblem(cells, firstRow.cells.length);
    if (extraCellsProblem) {
      problems.push({ line, message: `${rowLabel}: ${extraCellsProblem}` });
      continue;
    }

    // Campionato della riga: uno (con l'auto, che deve essere di quel campionato), "Nessuno" o vuoto.
    const championship = rawChampionship === '' ? undefined : matchCrewChampionship(rawChampionship, championships);
    const championshipCars = championship && championship !== 'none' ? cars.filter((car) => car.championships.includes(championship)) : [];
    const carId = rawCar === '' ? null : findCarId(rawCar, championshipCars);
    const championshipProblem =
      rawChampionship !== '' && championship === undefined
        ? `campionato "${rawChampionship}" non riconosciuto (ammessi: ${championships.join(', ')}, Nessuno, oppure vuoto)`
        : rawCar !== '' && (championship === undefined || championship === 'none')
          ? `auto "${rawCar}" senza campionato: l'auto vale per un campionato, indicalo nella stessa riga`
          : rawCar !== '' && carId === undefined
            ? `auto "${rawCar}" non disponibile nel ${String(championship)} (ammesse: ${championshipCars.map(formatCarName).join(', ') || 'nessuna'}, oppure vuota)`
            : undefined;

    const validation = validateCrewDraft(
      {
        name: rawName,
        number: /^\d{1,3}$/.test(rawNumber) ? Number(rawNumber) : null,
        championships: championship && championship !== 'none' && carId !== undefined ? [{ championship, carId }] : [],
        color: rawColor,
      },
      { areDetailsRequired: false },
    );

    if (!validation.isValid || championshipProblem) {
      const issues = validation.isValid ? {} : validation.issues;
      const reasons = [
        issues.name && NAME_ISSUE_MESSAGES[issues.name],
        issues.number && `numero "${rawNumber}" non valido (serve un intero da 0 a 999)`,
        championshipProblem,
        issues.color && `colore "${rawColor}" non valido (serve un esadecimale a 6 cifre, es. #E10600, oppure vuoto)`,
      ].filter(Boolean);
      problems.push({ line, message: `${rowLabel}: ${reasons.join('; ')}` });
      continue;
    }

    const { crew } = validation;
    const nameKey = toCrewNameKey(crew.name);
    const rowProblems: string[] = [];

    const previousLineWithNumber = lineByNumber.get(crew.number);
    if (previousLineWithNumber !== undefined) rowProblems.push(`numero ${crew.number} già usato alla riga ${previousLineWithNumber}`);

    const previousLineWithName = lineByNameKey.get(nameKey);
    if (previousLineWithName !== undefined) rowProblems.push(`nome già usato alla riga ${previousLineWithName}`);

    lineByNumber.set(crew.number, lineByNumber.get(crew.number) ?? line);
    lineByNameKey.set(nameKey, lineByNameKey.get(nameKey) ?? line);

    if (rowProblems.length > 0) problems.push({ line, message: `${rowLabel}: ${rowProblems.join('; ')}` });
    else {
      crews.push(crew);
      lines.push(line);
      championshipModes.push(championship === undefined ? 'keep' : championship === 'none' ? 'clear' : 'merge');
    }
  }

  return { crews, lines, championshipModes, problems };
}

/**
 * Il file diventa il nuovo elenco degli equipaggi. Ogni riga ritrova il suo equipaggio dal numero
 * (o, se il numero è nuovo, dal nome: equipaggio rinumerato) e lo aggiorna tenendo l'id, così
 * ordini di arrivo restano collegati; auto, campionato e colore lasciati vuoti nel file non
 * cancellano quelli già salvati. Gli equipaggi assenti dal file vengono eliminati, tranne quelli
 * presenti in un ordine di arrivo, che restano.
 */
export function planCrewSync(plan: CrewImportPlan, existingCrews: readonly ExistingCrew[]): CrewSyncPlan {
  const unmatched = new Set(existingCrews);
  const matches: { existing: ExistingCrew | undefined; draft: CrewDraft; line: number; mode: ChampionshipMode }[] = plan.crews.map((draft, index) => {
    const existing = existingCrews.find((crew) => unmatched.has(crew) && crew.number === draft.number);
    if (existing) unmatched.delete(existing);
    return { existing, draft, line: plan.lines[index] ?? 0, mode: plan.championshipModes[index] ?? 'merge' };
  });
  for (const match of matches) {
    if (match.existing) continue;
    const draftNameKey = toCrewNameKey(match.draft.name);
    match.existing = existingCrews.find((crew) => unmatched.has(crew) && toCrewNameKey(crew.name) === draftNameKey);
    if (match.existing) unmatched.delete(match.existing);
  }

  const kept = [...unmatched].filter((crew) => crew.usageCount > 0);
  const deletes = [...unmatched].filter((crew) => crew.usageCount === 0);

  const problems: CrewImportProblem[] = [];
  for (const { draft, line } of matches) {
    for (const keptCrew of kept) {
      const reason =
        keptCrew.number === draft.number
          ? `numero ${draft.number}`
          : toCrewNameKey(keptCrew.name) === toCrewNameKey(draft.name)
            ? 'nome'
            : undefined;
      if (reason) {
        problems.push({
          line,
          message: `${draft.name}: ${reason} già usato da "${keptCrew.name}", che non è nel file ma resta perché compare in ordini di arrivo, penalità o cambi pilota`,
        });
      }
    }
  }

  const updates = matches.flatMap(({ existing, draft, mode }) =>
    existing ? [{ existing, draft: { ...draft, championships: mergeChampionships(existing.championships, draft.championships, mode), color: draft.color ?? existing.color } }] : [],
  );
  const inserts = matches.filter((match) => !match.existing).map((match) => match.draft);
  return { problems, inserts, updates, deletes, kept };
}

/** Campionati finali di un equipaggio già salvato: quello della riga sostituisce lo stesso campionato (auto vuota = resta quella salvata). */
function mergeChampionships(saved: readonly CrewChampionshipEntry[], fromFile: readonly CrewChampionshipEntry[], mode: ChampionshipMode): CrewChampionshipEntry[] {
  if (mode === 'clear') return [];
  if (mode === 'keep') return [...saved];
  const merged = saved.filter((entry) => !fromFile.some((fileEntry) => fileEntry.championship === entry.championship));
  for (const fileEntry of fromFile) {
    const savedCar = saved.find((entry) => entry.championship === fileEntry.championship)?.carId ?? null;
    merged.push({ championship: fileEntry.championship, carId: fileEntry.carId ?? savedCar });
  }
  return sortCrewChampionships(merged);
}

/** Campionati di un equipaggio; crewIdSql = espressione SQL che dà l'id dell'equipaggio. */
const championshipInsertSql = (crewIdSql: string, crew: CrewDraft) =>
  crew.championships.map(
    ({ championship, carId }) => `INSERT INTO crew_championships (crew_id, championship, car_id) VALUES (${crewIdSql}, ${toSqlText(championship)}, ${carId ?? 'NULL'});`,
  );

/** Un INSERT per equipaggio, più i suoi campionati. I valori sono già convalidati, ma vengono comunque protetti come testo SQL. */
export function buildCrewInsertSql(crews: readonly CrewDraft[], importedBy: string): string {
  return crews
    .flatMap((crew) => [
      `INSERT INTO crews (name, name_key, number, color, created_by_discord_id) VALUES (${toSqlText(crew.name)}, ${toSqlText(toCrewNameKey(crew.name))}, ${crew.number}, ${toSqlText(crew.color)}, ${toSqlText(importedBy)});`,
      ...championshipInsertSql(`(SELECT id FROM crews WHERE number = ${crew.number})`, crew),
    ])
    .join('\n');
}

/**
 * Prima le eliminazioni; poi i nomi degli equipaggi da aggiornare passano per un valore provvisorio
 * ("~id", impossibile per un nome vero), così due equipaggi che si scambiano il nome non si scontrano
 * con il vincolo di unicità; infine aggiornamenti e nuovi equipaggi.
 */
export function buildCrewSyncSql(sync: CrewSyncPlan, importedBy: string): string {
  const statements: string[] = [];
  if (sync.deletes.length > 0) {
    const deletedIds = sync.deletes.map((crew) => crew.id).join(', ');
    statements.push(`DELETE FROM crew_championships WHERE crew_id IN (${deletedIds});`, `DELETE FROM crews WHERE id IN (${deletedIds});`);
  }
  if (sync.updates.length > 0) {
    statements.push(`UPDATE crews SET name_key = '~' || id WHERE id IN (${sync.updates.map(({ existing }) => existing.id).join(', ')});`);
  }
  for (const { existing, draft } of sync.updates) {
    statements.push(
      `UPDATE crews SET name = ${toSqlText(draft.name)}, name_key = ${toSqlText(toCrewNameKey(draft.name))}, number = ${draft.number}, color = ${toSqlText(draft.color)} WHERE id = ${existing.id};`,
      `DELETE FROM crew_championships WHERE crew_id = ${existing.id};`,
      ...championshipInsertSql(String(existing.id), draft),
    );
  }
  const insertSql = buildCrewInsertSql(sync.inserts, importedBy);
  if (insertSql !== '') statements.push(insertSql);
  return statements.join('\n');
}
