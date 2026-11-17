import { describe, expect, it } from 'vitest';
import { buildCrewInsertSql, buildCrewSyncSql, type ExistingCrew, type ImportableCar, parseCsv, planCrewImport, planCrewSync } from '../src/import/crewCsvImport';
import { createMigratedSqliteDatabase } from './support/inMemorySqlDatabase';

/** Le auto inserite dalla migrazione 0005 (stessi id). */
const CARS: ImportableCar[] = ['Audi', 'BMW', 'Ferrari', 'Lamborghini', 'Nissan', 'Porsche'].map((manufacturer, index) => ({
  id: index + 1,
  manufacturer,
  model: null,
}));

describe('lettura del CSV', () => {
  it('riconosce ";" di Excel, BOM, CRLF, virgolette e righe vuote', () => {
    const rows = parseCsv('﻿Nome;Numero;Auto\r\n"Scuderia;Uno";7;Ferrari\r\n\r\n"Il ""Team""";8;BMW\r\n');
    expect(rows).toEqual([
      { line: 1, cells: ['Nome', 'Numero', 'Auto'] },
      { line: 2, cells: ['Scuderia;Uno', '7', 'Ferrari'] },
      { line: 4, cells: ['Il "Team"', '8', 'BMW'] },
    ]);
  });

  it('riconosce anche virgole e tabulazioni', () => {
    expect(parseCsv('a,b,c\n1,2,3')[1]?.cells).toEqual(['1', '2', '3']);
    expect(parseCsv('a\tb\tc\n1\t2\t3')[1]?.cells).toEqual(['1', '2', '3']);
  });
});

describe("piano d'importazione", () => {
  it('trova le colonne dalle intestazioni in qualsiasi ordine e normalizza l’auto', () => {
    const plan = planCrewImport('Auto,N.,Nome Equipaggio\n ferrari ,007,ScuderiaRossa\nPORSCHE,12,Apex', CARS);
    expect(plan.problems).toEqual([]);
    expect(plan.crews).toEqual([
      { name: 'ScuderiaRossa', number: 7, carId: 3, championship: null, color: null, discordChannelId: null, discordRoleId: null },
      { name: 'Apex', number: 12, carId: 6, championship: null, color: null, discordChannelId: null, discordRoleId: null },
    ]);
  });

  it('auto facoltativa, campionato letto se presente, "#" davanti al numero ignorato', () => {
    const plan = planCrewImport('Nome;Numero;Campionato\nSim Racing Café;#690;Cool1 FIE Championship\nGT  Tribe Team Yellow ;20;', CARS);
    expect(plan.problems).toEqual([]);
    expect(plan.crews).toEqual([
      { name: 'Sim Racing Café', number: 690, carId: null, championship: 'Cool1 FIE Championship', color: null, discordChannelId: null, discordRoleId: null },
      { name: 'GT Tribe Team Yellow', number: 20, carId: null, championship: null, color: null, discordChannelId: null, discordRoleId: null },
    ]);
  });

  it('riconosce il campionato anche con il nome precedente', () => {
    const plan = planCrewImport('Nome;Numero;Campionato\nApex;1;FIE Cool1', CARS);
    expect(plan.crews[0]?.championship).toBe('Cool1 FIE Championship');
    // "Nessuno" (o "None") = l'equipaggio non partecipa a nessun campionato.
    expect(planCrewImport('Nome;Numero;Campionato\nApex;1;Nessuno\nBeta;2;none', CARS).crews.map((crew) => crew.championship)).toEqual(['None', 'None']);
  });

  it('legge il colore, con o senza "#", e segnala quelli non validi', () => {
    const plan = planCrewImport('Nome;Numero;Colore\nApex;1;e10600\nSakura;2;#00a3e0\nRossa;3;rosso', CARS);
    expect(plan.crews.map((crew) => crew.color)).toEqual(['#E10600', '#00A3E0']);
    expect(plan.problems.map((problem) => problem.line)).toEqual([4]);
    expect(plan.problems[0]?.message).toContain('colore "rosso" non valido');
  });

  it('senza intestazione usa l’ordine nome, numero, auto', () => {
    const plan = planCrewImport('Apex;1;BMW\nSakura;2;Nissan', CARS);
    expect(plan.crews.map((crew) => crew.name)).toEqual(['Apex', 'Sakura']);
  });

  it('segnala ogni riga non valida con il numero di riga e il motivo', () => {
    const plan = planCrewImport(
      'Nome;Numero;Auto\nTeam-Uno;1;BMW\nApex;1000;Audi\nSakura;3;Toyota\nOk;4;Audi',
      CARS,
    );
    expect(plan.problems.map((problem) => problem.line)).toEqual([2, 3, 4]);
    expect(plan.problems[0]?.message).toContain('solo lettere, numeri e spazi');
    expect(plan.problems[1]?.message).toContain('numero "1000" non valido');
    expect(plan.problems[2]?.message).toContain('auto "Toyota" non riconosciuta');
    expect(plan.crews).toHaveLength(1);
  });

  it('segnala i duplicati nel file e le righe con valori in più', () => {
    const plan = planCrewImport('Nome;Numero;Auto\nApex;1;BMW\napex;2;Audi\nSakura;1;Nissan\nRossa;9;Ferrari;x', CARS);
    expect(plan.problems.map((problem) => [problem.line, problem.message])).toEqual([
      [3, 'apex: nome già usato alla riga 2'],
      [4, 'Sakura: numero 1 già usato alla riga 2'],
      [5, 'Rossa: la riga ha un valore in più rispetto alle 3 colonne ("x"): forse un ";" al posto della virgola decimale'],
    ]);
  });

  it('un file vuoto è un problema', () => {
    expect(planCrewImport('\n\n', CARS).problems).toEqual([{ line: 1, message: 'il file è vuoto' }]);
  });
});

describe('SQL generato', () => {
  it('inserisce gli equipaggi rispettando i vincoli del database', () => {
    const database = createMigratedSqliteDatabase();

    const { crews } = planCrewImport("Nome;Numero;Auto;Campionato;Colore\nRennstall;7;Audi;Cool1 FIE Championship;#0055A4\nÉcurie d Or;8;;;", CARS);
    database.exec(buildCrewInsertSql(crews, 'import-csv'));

    const savedRows = database
      .prepare('SELECT name, name_key, number, car_id, championship, color, created_by_discord_id FROM crews ORDER BY number')
      .all()
      .map((row) => ({ ...row }));
    expect(savedRows).toEqual([
      { name: 'Rennstall', name_key: 'rennstall', number: 7, car_id: 1, championship: 'Cool1 FIE Championship', color: '#0055A4', created_by_discord_id: 'import-csv' },
      { name: 'Écurie d Or', name_key: 'écurie d or', number: 8, car_id: null, championship: null, color: null, created_by_discord_id: 'import-csv' },
    ]);
  });
});

describe('sostituzione degli equipaggi', () => {
  const existingCrew = (id: number, number: number, name: string, extra: Partial<ExistingCrew> = {}): ExistingCrew => ({
    id,
    number,
    name,
    carId: null,
    championship: null,
    color: null,
    usageCount: 0,
    ...extra,
  });

  it('aggiorna per numero (o per nome), tiene i dati non indicati nel file, aggiunge ed elimina', () => {
    const existing = [
      existingCrew(1, 16, 'Vez Team Lime', { carId: 3, color: '#00FF00', championship: 'Cool1 FIE Championship' }),
      existingCrew(2, 20, 'Vecchio Nome'),
      existingCrew(3, 77, 'Rinumerato'),
      existingCrew(4, 99, 'Prova da togliere'),
      existingCrew(5, 98, 'In classifica', { usageCount: 2 }),
    ];
    const plan = planCrewImport('crew_name;crew_number;car;championship;crew_color\nVez Team Lime;16;;;\nGT Tribe Team Yellow;20;Audi;;#FFD700\nRinumerato;78;;;\nNuovo;5;;;', CARS);
    const sync = planCrewSync(plan, existing);
    expect(sync.problems).toEqual([]);
    expect(sync.updates.map(({ existing: crew, draft }) => [crew.id, draft.number, draft.name, draft.carId, draft.color])).toEqual([
      [1, 16, 'Vez Team Lime', 3, '#00FF00'],
      [2, 20, 'GT Tribe Team Yellow', 1, '#FFD700'],
      [3, 78, 'Rinumerato', null, null],
    ]);
    expect(sync.updates[0]?.draft.championship).toBe('Cool1 FIE Championship');
    expect(sync.inserts.map((crew) => crew.name)).toEqual(['Nuovo']);
    expect(sync.deletes.map((crew) => crew.id)).toEqual([4]);
    expect(sync.kept.map((crew) => crew.id)).toEqual([5]);
  });

  it('segnala una riga che userebbe il nome o il numero di un equipaggio che resta', () => {
    const existing = [existingCrew(5, 98, 'In classifica', { usageCount: 1 }), existingCrew(6, 12, 'Dodici')];
    // Il numero 98 ritrova proprio l'equipaggio in classifica: nessun problema.
    expect(planCrewSync(planCrewImport('Nome;Numero\nIn classifica;98', CARS), existing).problems).toEqual([]);
    // Qui la riga aggiorna il #12 dandogli il nome dell'equipaggio in classifica, che però resta.
    expect(planCrewSync(planCrewImport('Nome;Numero\nIn Classifica;12', CARS), existing).problems).toEqual([
      { line: 2, message: 'In Classifica: nome già usato da "In classifica", che non è nel file ma resta perché compare in ordini di arrivo, penalità o cambi pilota' },
    ]);
  });

  it('applicata al database: nomi scambiati, ordini di arrivo intatti', () => {
    const database = createMigratedSqliteDatabase();
    database.exec(`
      INSERT INTO crews (id, name, name_key, number, car_id, championship, color, created_by_discord_id) VALUES
        (1, 'Alfa', 'alfa', 1, 3, 'Cool1 FIE Championship', '#E10600', 't'),
        (2, 'Beta', 'beta', 2, NULL, 'Cool1 FIE Championship', NULL, 't'),
        (3, 'Gamma', 'gamma', 3, NULL, NULL, NULL, 't');
      INSERT INTO races (id, championship, round, race_date, created_by_discord_id) VALUES (1, 'Cool1 FIE Championship', 1, '2026-10-01', 't');
      INSERT INTO race_results (race_id, position, crew_id, laps) VALUES (1, 1, 1, 20);
    `);
    const existing = database
      .prepare('SELECT id, name, number, car_id AS carId, championship, color, (SELECT COUNT(*) FROM race_results WHERE race_results.crew_id = crews.id) AS usageCount FROM crews')
      .all() as unknown as ExistingCrew[];
    const sync = planCrewSync(planCrewImport('crew_name;crew_number\nBeta;1\nAlfa;2\nDelta;4', CARS), existing);
    database.exec(buildCrewSyncSql(sync, 'import-csv'));

    const rows = database.prepare('SELECT id, name, name_key, number, car_id, color FROM crews ORDER BY number').all().map((row) => ({ ...row }));
    expect(rows).toEqual([
      { id: 1, name: 'Beta', name_key: 'beta', number: 1, car_id: 3, color: '#E10600' },
      { id: 2, name: 'Alfa', name_key: 'alfa', number: 2, car_id: null, color: null },
      { id: 4, name: 'Delta', name_key: 'delta', number: 4, car_id: null, color: null },
    ]);
    expect({ ...database.prepare('SELECT crew_id FROM race_results').get() }).toEqual({ crew_id: 1 });
  });
});
