import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planCrewImport } from '../src/import/crewCsvImport';
import { parseCsvNumber } from '../src/import/csv';
import { buildTrackSyncSql, type ExistingTrack, planTrackImport } from '../src/import/trackCsvImport';
import { createMigratedSqliteDatabase } from './support/inMemorySqlDatabase';

/** Piano di sincronizzazione atteso: fallisce il test se l'importazione non ne ha prodotto uno. */
function requirePlan<Plan>(plan: Plan | null | undefined): Plan {
  if (plan === null || plan === undefined) throw new Error('Piano di sincronizzazione mancante');
  return plan;
}

describe('numeri nei CSV', () => {
  it('legge i numeri scritti all\'italiana', () => {
    expect(parseCsvNumber('1.250')).toBe(1250);
    expect(parseCsvNumber('95,5')).toBe(95.5);
    expect(parseCsvNumber(' 20% ')).toBe(20);
    expect(parseCsvNumber('')).toBeNull();
    expect(Number.isNaN(parseCsvNumber('tanti'))).toBe(true);
  });
});

describe('importazione delle piste', () => {
  const existingTrack = (id: number, name: string, usageCount = 0, configuration: string | null = null): ExistingTrack => ({
    id,
    name,
    configuration,
    continent: null,
    lengthMeters: null,
    hasReverseLayout: null,
    usageCount,
  });

  it('una pista per configurazione, con tutti i suoi dati; aggiorna, aggiunge ed elimina solo quelle non usate', () => {
    const existing = [existingTrack(1, 'monza'), existingTrack(2, 'Imola', 1), existingTrack(3, 'Vallelunga')];
    const csv = [
      'continent;track;configuration;lenght;hasReverse',
      'Europe - Middle East;Monza;Full Course;5793;false',
      'Europe - Middle East; Monza;No Chicane;5755;false',
      'Asia;Kyoto Driving Park;Yamagiwa + Miyabi;6846;true',
    ].join('\n');
    const { problems, sync } = planTrackImport(csv, existing);
    expect(problems).toEqual([]);
    // "monza" senza configurazione: nel file ce ne sono due, quindi non si sa quale sia e viene eliminata (non è usata).
    expect(sync?.updates).toEqual([]);
    expect(sync?.inserts).toEqual([
      { name: 'Monza', configuration: 'Full Course', continent: 'Europe - Middle East', lengthMeters: 5793, hasReverseLayout: false },
      { name: 'Monza', configuration: 'No Chicane', continent: 'Europe - Middle East', lengthMeters: 5755, hasReverseLayout: false },
      { name: 'Kyoto Driving Park', configuration: 'Yamagiwa + Miyabi', continent: 'Asia', lengthMeters: 6846, hasReverseLayout: true },
    ]);
    expect(sync?.deletes.map((track) => track.id)).toEqual([1, 3]);
    expect(sync?.kept.map((track) => track.id)).toEqual([2]);
  });

  it('una pista senza configurazione diventa quella del file se il nome compare una volta sola', () => {
    const { sync } = planTrackImport('track_name;configuration\nImola;Full Course', [existingTrack(2, 'Imola', 1)]);
    expect(sync?.updates.map(({ existing: track, draft }) => [track.id, draft.configuration])).toEqual([[2, 'Full Course']]);
    expect(sync?.kept).toEqual([]);
  });

  it('funziona anche senza intestazione e segnala dati non validi, ripetuti o righe con valori in più', () => {
    expect(planTrackImport('Monza\nImola', []).sync?.inserts.map((track) => track.name)).toEqual(['Monza', 'Imola']);
    expect(planTrackImport('track_name;configuration;length_meters;has_reverse_layout\nMonza;Full;;\nMONZA;full;;\n#Monza;;;\nGrand Valley;South;3076true;\nAlsace;Village;5423;forse\nSuzuka;East;2243;false;x', []).problems).toEqual([
      { line: 3, message: '"MONZA - full": pista già presente alla riga 2' },
      { line: 4, message: '"#Monza": nome "#Monza" non valido (massimo 64 caratteri tra lettere, numeri, spazi e . \' & ( ) / + -)' },
      { line: 5, message: '"Grand Valley - South": lunghezza "3076true" non valida (metri, intero da 1 a 99999, oppure vuota)' },
      { line: 6, message: '"Alsace - Village": senso inverso "forse" non valido (true o false, oppure vuoto)' },
      { line: 7, message: '"Suzuka - East": la riga ha un valore in più rispetto alle 4 colonne ("x"): forse un ";" al posto della virgola decimale' },
    ]);
  });

  it('applicato al database: le gare restano collegate e mostrano nome e configurazione', () => {
    const database = createMigratedSqliteDatabase();
    database.exec("INSERT INTO tracks (id, name, name_key) VALUES (1, 'Imola', 'imola|'); INSERT INTO races (championship, round, track_id, race_date, created_by_discord_id) VALUES ('Cool1 FIE Championship', 1, 1, '2026-10-01', 't');");
    const existing = [existingTrack(1, 'Imola', 1)];
    const { sync } = planTrackImport("continent;track_name;configuration;length_meters;has_reverse_layout\nEurope - Middle East;Imola;Full Course;4909;false\nEurope - Middle East;Circuit de l'Eau;A;1000;true", existing);
    database.exec(buildTrackSyncSql(requirePlan(sync)));
    expect(database.prepare('SELECT id, name, name_key, configuration, length_meters, has_reverse_layout FROM tracks ORDER BY id').all().map((row) => ({ ...row }))).toEqual([
      { id: 1, name: 'Imola', name_key: 'imola|full course', configuration: 'Full Course', length_meters: 4909, has_reverse_layout: 0 },
      { id: 2, name: "Circuit de l'Eau", name_key: "circuit de l'eau|a", configuration: 'A', length_meters: 1000, has_reverse_layout: 1 },
    ]);
    expect({ ...database.prepare('SELECT track_id FROM races').get() }).toEqual({ track_id: 1 });
  });
});

describe('file pronti in server/data', () => {
  const readDataFile = (fileName: string) => readFileSync(join(import.meta.dirname, '../data', fileName), 'utf8');

  it('crews.csv: i 15 equipaggi FIE, riconosciuti dalle intestazioni in inglese', () => {
    const { crews, problems } = planCrewImport(readDataFile('crews.csv'), [], ['All Japan GT Championship', 'Cool1 FIE Championship']);
    expect(problems).toEqual([]);
    expect(crews).toHaveLength(15);
    expect(crews[0]).toMatchObject({ name: 'Vez Team Lime', number: 16, championships: [{ championship: 'Cool1 FIE Championship', carId: null }], color: null });
    expect(crews.map((crew) => crew.name)).toContain('Sim Racing Café');
  });

  it('tracks.csv: 84 configurazioni, tutte valide', () => {
    const { problems, sync } = planTrackImport(readDataFile('tracks.csv'), []);
    expect(problems).toEqual([]);
    expect(sync?.inserts).toHaveLength(84);
    expect(sync?.inserts.find((track) => track.name === 'Grand Valley' && track.configuration === 'South')).toEqual({
      name: 'Grand Valley',
      configuration: 'South',
      continent: 'Americas',
      lengthMeters: 3076,
      hasReverseLayout: true,
    });
  });

  it('races.csv e race_results.csv hanno solo l\'intestazione', () => {
    for (const fileName of ['races.csv', 'race_results.csv']) {
      expect(readDataFile(fileName).trim().split('\n')).toHaveLength(1);
    }
  });
});
