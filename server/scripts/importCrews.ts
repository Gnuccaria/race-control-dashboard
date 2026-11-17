/**
 * Sostituisce l'elenco degli equipaggi con quello di un file CSV
 * (colonne: crew_name, crew_number, car, championship, crew_color; obbligatori solo nome e numero).
 *
 *   npm run crews:import -- percorso/crews.csv --dry-run        → mostra cosa cambierebbe, senza scrivere
 *   npm run crews:import -- percorso/crews.csv                    → scrive nel database online su Cloudflare
 *
 * Ogni riga aggiorna l'equipaggio con lo stesso numero (o, se il numero è nuovo, con lo stesso nome),
 * oppure ne crea uno nuovo. Il campionato della riga (uno di quelli creati nell'app) (con la sua auto) si aggiunge a quelli salvati; vuoto li lascia,
 * "Nessuno" li toglie tutti. Il colore lasciato vuoto non cancella quello salvato.
 * Gli equipaggi assenti dal file vengono eliminati, tranne quelli presenti in un ordine di arrivo.
 * Tutto o niente: se anche una sola riga ha un problema, non cambia nulla.
 */
import { formatCarName } from '../../shared/carRules';
import { type CrewDraft, isCrewChampionship } from '../../shared/crewRules';
import { buildCrewSyncSql, type ExistingCrew, type ImportableCar, planCrewImport, planCrewSync } from '../src/import/crewCsvImport';
import { countLabel, createD1Client, exitWithProblems, readCsvFile, readImportCommandLine } from './wranglerD1';

const IMPORTED_BY = 'import-csv';

const { csvPath, isDryRun } = readImportCommandLine('npm run crews:import -- crews.csv');
const csvText = readCsvFile(csvPath);
const database = createD1Client();

console.log(`Lettura di campionati, equipaggi e auto presenti nel database online…`);
const championships = database.select<{ name: string }>('SELECT name FROM championships ORDER BY name COLLATE NOCASE').map((row) => row.name);
// Campionati di auto ed equipaggi come elenchi separati da "|" (il client di wrangler restituisce solo testo semplice).
const cars = database
  .select<Omit<ImportableCar, 'championships'> & { championshipsText: string | null }>(
    "SELECT id, manufacturer, model, (SELECT group_concat(championship, '|') FROM car_championships WHERE car_id = cars.id) AS championshipsText FROM cars",
  )
  .map(({ championshipsText, ...car }) => ({ ...car, championships: (championshipsText ?? '').split('|').filter(Boolean) }));
const existingCrews = database
  .select<Omit<ExistingCrew, 'championships'> & { championshipsText: string | null }>(
    "SELECT id, name, number, color, (SELECT group_concat(championship || '=' || IFNULL(car_id, ''), '|') FROM crew_championships WHERE crew_id = crews.id) AS championshipsText, (SELECT COUNT(*) FROM race_results WHERE race_results.crew_id = crews.id) + (SELECT COUNT(*) FROM penalty_crews WHERE penalty_crews.crew_id = crews.id) + (SELECT COUNT(*) FROM driver_swaps WHERE driver_swaps.crew_id = crews.id) AS usageCount FROM crews",
  )
  .map(({ championshipsText, ...crew }) => ({
    ...crew,
    championships: (championshipsText ?? '')
      .split('|')
      .filter(Boolean)
      .flatMap((part) => {
        const [championship, carText] = part.split('=');
        return isCrewChampionship(championship) ? [{ championship, carId: carText ? Number(carText) : null }] : [];
      }),
  }));
const carNameById = new Map(cars.map((car) => [car.id, formatCarName(car)]));

const importPlan = planCrewImport(csvText, cars, championships);
if (importPlan.problems.length > 0) exitWithProblems(importPlan.problems, 'gli equipaggi non sono stati modificati');
if (importPlan.crews.length === 0) exitWithProblems([{ line: 1, message: 'nel file non ci sono equipaggi' }], 'gli equipaggi non sono stati modificati');
const sync = planCrewSync(importPlan, existingCrews);
if (sync.problems.length > 0) exitWithProblems(sync.problems, 'gli equipaggi non sono stati modificati');

const describe = (crew: CrewDraft) => {
  const championships = crew.championships.map(
    ({ championship, carId }) => `${championship}: ${carId === null ? 'auto da definire' : (carNameById.get(carId) ?? 'auto sconosciuta')}`,
  );
  return `#${String(crew.number).padStart(3)}  ${crew.name}  (${[...championships, crew.color].filter(Boolean).join(', ') || 'nessun campionato'})`;
};

console.log(`\nEquipaggi nuovi: ${sync.inserts.length}`);
for (const crew of sync.inserts) console.log(`  + ${describe(crew)}`);
console.log(`Equipaggi aggiornati: ${sync.updates.length}`);
for (const { existing, draft } of sync.updates) {
  const renamed = existing.name !== draft.name || existing.number !== draft.number ? `  [prima: #${existing.number} ${existing.name}]` : '';
  console.log(`  ~ ${describe(draft)}${renamed}`);
}
console.log(`Equipaggi eliminati: ${sync.deletes.length}`);
for (const crew of sync.deletes) console.log(`  - #${String(crew.number).padStart(3)}  ${crew.name}`);
if (sync.kept.length > 0) {
  console.log(`\n⚠ Non sono nel file ma restano, perché compaiono in ordini di arrivo, penalità o cambi pilota:`);
  for (const crew of sync.kept) console.log(`  ! #${String(crew.number).padStart(3)}  ${crew.name}  [${countLabel(crew.usageCount, 'riferimento', 'riferimenti')}]`);
}

if (isDryRun) {
  console.log('\nProva completata (--dry-run): nessuna modifica al database.\n');
  process.exit(0);
}

const sqlText = buildCrewSyncSql(sync, IMPORTED_BY);
if (sqlText !== '') database.executeSql(sqlText);
console.log(`\n✔ Equipaggi aggiornati nel database online.\n`);
