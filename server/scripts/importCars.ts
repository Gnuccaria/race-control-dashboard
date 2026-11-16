/**
 * Sostituisce l'elenco delle auto con quello di un file CSV
 * (colonne: Costruttore, Modello, PS, kg, Limitatore, Zavorra; solo il costruttore è obbligatorio).
 *
 *   npm run cars:import -- percorso/auto.csv --dry-run           → mostra cosa cambierebbe, senza scrivere
 *   npm run cars:import -- percorso/auto.csv                       → scrive nel database online su Cloudflare
 *
 * Le auto con lo stesso costruttore e modello vengono aggiornate (gli equipaggi restano collegati),
 * quelle nuove aggiunte, quelle non più nel file eliminate. Un'auto non più nel file ma usata da
 * qualche equipaggio o in una gara salvata non viene eliminata.
 * Tutto o niente: se anche una sola riga ha un problema, non cambia nulla.
 */
import { type Car, formatCarName } from '../../shared/carRules';
import { buildCarSyncSql, type ExistingCar, planCarImport } from '../src/import/carCsvImport';
import { countLabel, createD1Client, exitWithProblems, readCsvFile, readImportCommandLine } from './wranglerD1';

const { csvPath, isDryRun } = readImportCommandLine('npm run cars:import -- auto.csv');
const csvText = readCsvFile(csvPath);
const database = createD1Client();

console.log(`Lettura delle auto presenti nel database online…`);
const existingCars = database.select<ExistingCar>(
  'SELECT id, manufacturer, model, horsepower, weight_kg AS weightKg, limiter, ballast_kg AS ballastKg, (SELECT COUNT(*) FROM crews WHERE crews.car_id = cars.id) + (SELECT COUNT(*) FROM race_results WHERE race_results.car_id = cars.id) AS usageCount FROM cars',
);
const { problems, sync } = planCarImport(csvText, existingCars);
if (!sync) exitWithProblems(problems, 'la tabella delle auto non è stata modificata');

const describe = (car: Omit<Car, 'id'>) => {
  const details = [
    car.horsepower !== null && `${car.horsepower} PS`,
    car.weightKg !== null && `${car.weightKg} kg`,
    car.limiter !== null && `limitatore ${car.limiter}`,
    car.ballastKg !== null && `zavorra ${car.ballastKg} kg`,
  ].filter(Boolean);
  return details.length > 0 ? `${formatCarName(car)} (${details.join(', ')})` : formatCarName(car);
};

console.log(`\nAuto nuove: ${sync.inserts.length}`);
for (const car of sync.inserts) console.log(`  + ${describe(car)}`);
console.log(`Auto aggiornate: ${sync.updates.length}`);
for (const { existing, draft } of sync.updates) {
  const renamed = formatCarName(existing) !== formatCarName(draft) ? `${formatCarName(existing)} → ` : '';
  console.log(`  ~ ${renamed}${describe(draft)}${existing.usageCount > 0 ? `  [${countLabel(existing.usageCount, 'utilizzo', 'utilizzi')}]` : ''}`);
}
console.log(`Auto eliminate: ${sync.deletes.length}`);
for (const car of sync.deletes) console.log(`  - ${formatCarName(car)}`);
if (sync.kept.length > 0) {
  console.log(
    sync.kept.length === 1
      ? '\n⚠ 1 auto non è nel file ma resta, perché usata da qualche equipaggio o in una gara salvata:'
      : `\n⚠ ${sync.kept.length} auto non sono nel file ma restano, perché usate da equipaggi o in gare salvate:`,
  );
  for (const car of sync.kept) console.log(`  ! ${formatCarName(car)}  [${countLabel(car.usageCount, 'utilizzo', 'utilizzi')}]`);
  console.log('  Le auto usate nelle gare salvate restano per sempre; quelle solo degli equipaggi si eliminano assegnando loro un\'auto del nuovo elenco (dall\'app) e rilanciando il comando.');
}

if (isDryRun) {
  console.log('\nProva completata (--dry-run): nessuna modifica al database.\n');
  process.exit(0);
}

const sqlText = buildCarSyncSql(sync);
if (sqlText !== '') database.executeSql(sqlText);
console.log(`\n✔ Tabella delle auto aggiornata nel database online.\n`);
