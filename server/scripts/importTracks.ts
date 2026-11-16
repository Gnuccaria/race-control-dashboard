/**
 * Sostituisce l'elenco delle piste con quello di un file CSV: una riga per configurazione, colonne
 * continent, track_name, configuration, length_meters, has_reverse_layout (solo il nome è obbligatorio).
 *
 *   npm run tracks:import -- percorso/piste.csv --dry-run        → mostra cosa cambierebbe, senza scrivere
 *   npm run tracks:import -- percorso/piste.csv                    → scrive nel database online su Cloudflare
 *
 * Le piste con lo stesso nome e configurazione (senza badare a maiuscole) restano con il loro id, quelle nuove vengono
 * aggiunte, quelle non più nel file eliminate. Una pista non più nel file ma usata da qualche gara
 * non viene eliminata, per non togliere la pista a quelle gare.
 * Tutto o niente: se anche una sola riga ha un problema, non cambia nulla.
 */
import { formatTrackName, type TrackDraft } from '../../shared/raceRules';
import { buildTrackSyncSql, type ExistingTrack, planTrackImport } from '../src/import/trackCsvImport';
import { countLabel, createD1Client, exitWithProblems, readCsvFile, readImportCommandLine } from './wranglerD1';

const { csvPath, isDryRun } = readImportCommandLine('npm run tracks:import -- piste.csv');
const csvText = readCsvFile(csvPath);
const database = createD1Client();

console.log(`Lettura delle piste presenti nel database online…`);
const existingTracks = database
  .select<Omit<ExistingTrack, 'hasReverseLayout'> & { hasReverseLayout: number | null }>(
  'SELECT id, name, configuration, continent, length_meters AS lengthMeters, has_reverse_layout AS hasReverseLayout, (SELECT COUNT(*) FROM races WHERE races.track_id = tracks.id) AS usageCount FROM tracks',
  )
  .map((track): ExistingTrack => ({ ...track, hasReverseLayout: track.hasReverseLayout === null ? null : track.hasReverseLayout === 1 }));

const describe = (track: TrackDraft) => {
  const details = [
    track.continent,
    track.lengthMeters !== null && `${track.lengthMeters} m`,
    track.hasReverseLayout !== null && (track.hasReverseLayout ? 'anche in senso inverso' : 'senza senso inverso'),
  ].filter(Boolean);
  return details.length > 0 ? `${formatTrackName(track)} — ${details.join(", ")}` : formatTrackName(track);
};
const { problems, sync } = planTrackImport(csvText, existingTracks);
if (!sync) exitWithProblems(problems, 'la tabella delle piste non è stata modificata');

console.log(`\nPiste nuove: ${sync.inserts.length}`);
for (const track of sync.inserts) console.log(`  + ${describe(track)}`);
console.log(`Piste aggiornate: ${sync.updates.length}`);
for (const { existing, draft } of sync.updates) {
  const renamed = formatTrackName(existing) !== formatTrackName(draft) ? `${formatTrackName(existing)} → ` : '';
  console.log(`  ~ ${renamed}${describe(draft)}`);
}
console.log(`Piste eliminate: ${sync.deletes.length}`);
for (const track of sync.deletes) console.log(`  - ${formatTrackName(track)}`);
if (sync.kept.length > 0) {
  console.log(
    sync.kept.length === 1
      ? '\n⚠ 1 pista non è nel file ma resta, perché usata da qualche gara:'
      : `\n⚠ ${sync.kept.length} piste non sono nel file ma restano, perché usate da qualche gara:`,
  );
  for (const track of sync.kept) console.log(`  ! ${formatTrackName(track)}  [${countLabel(track.usageCount, 'gara', 'gare')}]`);
}

if (isDryRun) {
  console.log('\nProva completata (--dry-run): nessuna modifica al database.\n');
  process.exit(0);
}

const sqlText = buildTrackSyncSql(sync);
if (sqlText !== '') database.executeSql(sqlText);
console.log(`\n✔ Tabella delle piste aggiornata nel database online.\n`);
