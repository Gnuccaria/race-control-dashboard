import {
  type CrewDraft,
  CHAMPIONSHIP_FORMER_NAMES,
  CREW_CHAMPIONSHIPS,
  type CrewChampionshipChoice,
  NO_CHAMPIONSHIP,
  CREW_NAME_MAX_LENGTH,
  toCrewNameKey,
  validateCrewDraft,
} from '../../../shared/crewRules';
import { type Car, formatCarName } from '../../../shared/carRules';
import { findExtraCellsProblem, type ImportProblem, normalizeHeader, parseCsv, readCell, toSqlText } from './csv';

export { parseCsv };

/** Auto conosciute dal database: le auto del CSV vengono cercate per nome qui dentro. */
export type ImportableCar = Pick<Car, 'id' | 'manufacturer' | 'model'>;

/**
 * Importazione di equipaggi da CSV: lettura del file, controllo di ogni riga con le stesse
 * regole dell'app e del server, ricerca dei duplicati e preparazione dell'SQL.
 * Tutto puro (niente file né rete), così è testabile; lo script scripts/importCrews.ts fa il resto.
 */

export type CrewImportProblem = ImportProblem;

export interface CrewImportPlan {
  readonly crews: readonly CrewDraft[];
  /** Riga del file di ogni equipaggio (stesso ordine di crews). */
  readonly lines: readonly number[];
  readonly problems: readonly CrewImportProblem[];
}

/** Equipaggio già nel database, con il numero di ordini di arrivo in cui compare. */
export interface ExistingCrew {
  readonly id: number;
  readonly name: string;
  readonly number: number;
  readonly carId: number | null;
  readonly championship: string | null;
  readonly color: string | null;
  readonly usageCount: number;
}

export interface CrewSyncPlan {
  readonly problems: readonly CrewImportProblem[];
  readonly inserts: readonly CrewDraft[];
  /** draft = dati finali: auto, campionato e colore vuoti nel file restano quelli già salvati. */
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
function matchCrewChampionship(rawChampionship: string): CrewChampionshipChoice | undefined {
  const championshipKey = rawChampionship.trim().replace(/\s+/g, ' ').toLowerCase();
  if (NO_CHAMPIONSHIP_ALIASES.includes(championshipKey)) return NO_CHAMPIONSHIP;
  return (
    CREW_CHAMPIONSHIPS.find((championship) => championship.toLowerCase() === championshipKey) ??
    CHAMPIONSHIP_FORMER_NAMES[championshipKey]
  );
}

const NAME_ISSUE_MESSAGES = {
  required: 'nome mancante',
  'invalid-characters': 'il nome può contenere solo lettere, numeri e spazi tra le parole',
  'too-long': `il nome supera i ${CREW_NAME_MAX_LENGTH} caratteri`,
} as const;

/** Controlla tutto il file prima di scrivere qualsiasi cosa: dati non validi e duplicati dentro il file. */
export function planCrewImport(csvText: string, cars: readonly ImportableCar[]): CrewImportPlan {
  const rows = parseCsv(csvText);
  const [firstRow] = rows;
  if (!firstRow) return { crews: [], lines: [], problems: [{ line: 1, message: 'il file è vuoto' }] };

  const headerPositions = findColumnPositions(firstRow.cells);
  const columnPositions = headerPositions ?? DEFAULT_COLUMN_POSITIONS;
  const dataRows = headerPositions ? rows.slice(1) : rows;

  const crews: CrewDraft[] = [];
  const lines: number[] = [];
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

    const validation = validateCrewDraft(
      {
        name: rawName,
        number: /^\d{1,3}$/.test(rawNumber) ? Number(rawNumber) : null,
        // Auto non trovata: un valore non valido fa scattare il messaggio con l'elenco delle auto ammesse.
        carId: rawCar === '' ? null : (findCarId(rawCar, cars) ?? 'unknown'),
        championship: matchCrewChampionship(rawChampionship) ?? rawChampionship,
        color: rawColor,
      },
      { areDetailsRequired: false },
    );

    if (!validation.isValid) {
      const { issues } = validation;
      const reasons = [
        issues.name && NAME_ISSUE_MESSAGES[issues.name],
        issues.number && `numero "${rawNumber}" non valido (serve un intero da 0 a 999)`,
        issues.carId && `auto "${rawCar}" non riconosciuta (ammesse: ${cars.map(formatCarName).join(', ')}, oppure vuota)`,
        issues.championship &&
          `campionato "${rawChampionship}" non riconosciuto (ammessi: ${CREW_CHAMPIONSHIPS.join(', ')}, Nessuno, oppure vuoto)`,
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
    }
  }

  return { crews, lines, problems };
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
  const matches: { existing: ExistingCrew | undefined; draft: CrewDraft; line: number }[] = plan.crews.map((draft, index) => {
    const existing = existingCrews.find((crew) => unmatched.has(crew) && crew.number === draft.number);
    if (existing) unmatched.delete(existing);
    return { existing, draft, line: plan.lines[index] ?? 0 };
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

  const updates = matches.flatMap(({ existing, draft }) =>
    existing
      ? [
          {
            existing,
            draft: {
              ...draft,
              carId: draft.carId ?? existing.carId,
              championship: draft.championship ?? (existing.championship as CrewDraft['championship']),
              color: draft.color ?? existing.color,
            },
          },
        ]
      : [],
  );
  const inserts = matches.filter((match) => !match.existing).map((match) => match.draft);
  return { problems, inserts, updates, deletes, kept };
}

/** Un INSERT per equipaggio. I valori sono già convalidati, ma vengono comunque protetti come testo SQL. */
export function buildCrewInsertSql(crews: readonly CrewDraft[], importedBy: string): string {
  return crews
    .map(
      (crew) =>
        `INSERT INTO crews (name, name_key, number, car_id, championship, color, created_by_discord_id) VALUES (${toSqlText(crew.name)}, ${toSqlText(toCrewNameKey(crew.name))}, ${crew.number}, ${crew.carId ?? 'NULL'}, ${toSqlText(crew.championship)}, ${toSqlText(crew.color)}, ${toSqlText(importedBy)});`,
    )
    .join('\n');
}

/**
 * Prima le eliminazioni; poi i nomi degli equipaggi da aggiornare passano per un valore provvisorio
 * ("~id", impossibile per un nome vero), così due equipaggi che si scambiano il nome non si scontrano
 * con il vincolo di unicità; infine aggiornamenti e nuovi equipaggi.
 */
export function buildCrewSyncSql(sync: CrewSyncPlan, importedBy: string): string {
  const statements: string[] = [];
  if (sync.deletes.length > 0) statements.push(`DELETE FROM crews WHERE id IN (${sync.deletes.map((crew) => crew.id).join(', ')});`);
  if (sync.updates.length > 0) {
    statements.push(`UPDATE crews SET name_key = '~' || id WHERE id IN (${sync.updates.map(({ existing }) => existing.id).join(', ')});`);
  }
  for (const { existing, draft } of sync.updates) {
    statements.push(
      `UPDATE crews SET name = ${toSqlText(draft.name)}, name_key = ${toSqlText(toCrewNameKey(draft.name))}, number = ${draft.number}, car_id = ${draft.carId ?? 'NULL'}, championship = ${toSqlText(draft.championship)}, color = ${toSqlText(draft.color)} WHERE id = ${existing.id};`,
    );
  }
  const insertSql = buildCrewInsertSql(sync.inserts, importedBy);
  if (insertSql !== '') statements.push(insertSql);
  return statements.join('\n');
}
