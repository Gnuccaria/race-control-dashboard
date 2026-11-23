import { describe, expect, it } from 'vitest';
import { buildCrewInsertSql, buildCrewSyncSql, type ExistingCrew, type ImportableCar, parseCsv, planCrewImport, planCrewSync } from '../src/import/crewCsvImport';
import { createMigratedSqliteDatabase } from './support/inMemorySqlDatabase';

const FIE = 'Cool1 FIE Championship';
const JAPAN = 'All Japan GT Championship';

/** Le auto inserite dalla migrazione 0005 (stessi id), tutte del Cool1 FIE; la Nissan anche dell'All Japan GT. */
const CARS: ImportableCar[] = ['Audi', 'BMW', 'Ferrari', 'Lamborghini', 'Nissan', 'Porsche'].map((manufacturer, index) => ({
  id: index + 1,
  manufacturer,
  model: null,
  championships: manufacturer === 'Nissan' ? [FIE, JAPAN] : [FIE],
}));

/** I campionati della migrazione 0028. */
const CHAMPIONSHIPS = [JAPAN, FIE];

const draft = (name: string, number: number, championships: { championship: string; carId: number | null }[] = [], color: string | null = null) => ({
  name,
  number,
  championships,
  color,
  discordChannelId: null,
  discordRoleId: null,
});

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
  it('trova le colonne dalle intestazioni in qualsiasi ordine e cerca l’auto tra quelle del campionato', () => {
    const plan = planCrewImport(`Auto,N.,Nome Equipaggio,Campionato\n ferrari ,007,ScuderiaRossa,${FIE}\nnissan,12,Apex,${JAPAN}`, CARS, CHAMPIONSHIPS);
    expect(plan.problems).toEqual([]);
    expect(plan.crews).toEqual([draft('ScuderiaRossa', 7, [{ championship: FIE, carId: 3 }]), draft('Apex', 12, [{ championship: JAPAN, carId: 5 }])]);
    expect(plan.championshipModes).toEqual(['merge', 'merge']);
  });

  it('riconosce le intestazioni in inglese di Excel, anche con il BOM all\'inizio del file', () => {
    const plan = planCrewImport(`\uFEFFcrew_name;crew_number;car;championship;crew_color\nVez Team Lime;16;;${FIE};\nApex;12;nissan;${JAPAN};#e10600`, CARS, CHAMPIONSHIPS);
    expect(plan.problems).toEqual([]);
    expect(plan.crews).toMatchObject([
      { name: 'Vez Team Lime', number: 16, championships: [{ championship: FIE, carId: null }], color: null },
      { name: 'Apex', number: 12, championships: [{ championship: JAPAN, carId: 5 }], color: '#E10600' },
    ]);
  });

  it('auto facoltativa, campionato letto se presente, "#" davanti al numero ignorato', () => {
    const plan = planCrewImport(`Nome;Numero;Campionato\nSim Racing Café;#690;${FIE}\nGT  Tribe Team Yellow ;20;`, CARS, CHAMPIONSHIPS);
    expect(plan.problems).toEqual([]);
    expect(plan.crews).toEqual([draft('Sim Racing Café', 690, [{ championship: FIE, carId: null }]), draft('GT Tribe Team Yellow', 20)]);
    expect(plan.championshipModes).toEqual(['merge', 'keep']);
  });

  it('riconosce il campionato anche con il nome precedente; "Nessuno" toglie tutti i campionati', () => {
    const plan = planCrewImport('Nome;Numero;Campionato\nApex;1;FIE Cool1', CARS, CHAMPIONSHIPS);
    expect(plan.crews[0]?.championships).toEqual([{ championship: FIE, carId: null }]);
    expect(planCrewImport('Nome;Numero;Campionato\nApex;1;Nessuno\nBeta;2;none', CARS, CHAMPIONSHIPS).championshipModes).toEqual(['clear', 'clear']);
  });

  it('legge il colore, con o senza "#", e segnala quelli non validi', () => {
    const plan = planCrewImport('Nome;Numero;Colore\nApex;1;e10600\nSakura;2;#00a3e0\nRossa;3;rosso', CARS, CHAMPIONSHIPS);
    expect(plan.crews.map((crew) => crew.color)).toEqual(['#E10600', '#00A3E0']);
    expect(plan.problems.map((problem) => problem.line)).toEqual([4]);
    expect(plan.problems[0]?.message).toContain('colore "rosso" non valido');
  });

  it('senza intestazione usa l’ordine nome, numero, auto, campionato', () => {
    const plan = planCrewImport(`Apex;1;BMW;${FIE}\nSakura;2;Nissan;${JAPAN}`, CARS, CHAMPIONSHIPS);
    expect(plan.crews.map((crew) => crew.name)).toEqual(['Apex', 'Sakura']);
  });

  it('segnala ogni riga non valida con il numero di riga e il motivo', () => {
    const plan = planCrewImport(
      `Nome;Numero;Auto;Campionato\nTeam-Uno;1;BMW;${FIE}\nApex;1000;Audi;${FIE}\nSakura;3;Toyota;${FIE}\nKyoto;5;Audi;${JAPAN}\nSolo;6;Audi;\nOk;4;Audi;${FIE}`,
      CARS,
      CHAMPIONSHIPS,
    );
    expect(plan.problems.map((problem) => problem.line)).toEqual([2, 3, 4, 5, 6]);
    expect(plan.problems[0]?.message).toContain('solo lettere, numeri e spazi');
    expect(plan.problems[1]?.message).toContain('numero "1000" non valido');
    expect(plan.problems[2]?.message).toContain('auto "Toyota" non disponibile');
    expect(plan.problems[3]?.message).toContain('auto "Audi" non disponibile nel All Japan GT Championship (ammesse: Nissan');
    expect(plan.problems[4]?.message).toContain('auto "Audi" senza campionato');
    expect(plan.crews).toHaveLength(1);
  });

  it('segnala i duplicati nel file e le righe con valori in più', () => {
    const plan = planCrewImport('Nome;Numero;Colore\nApex;1;#E10600\napex;2;#E10600\nSakura;1;#E10600\nRossa;9;#E10600;x', CARS, CHAMPIONSHIPS);
    expect(plan.problems.map((problem) => [problem.line, problem.message])).toEqual([
      [3, 'apex: nome già usato alla riga 2'],
      [4, 'Sakura: numero 1 già usato alla riga 2'],
      [5, 'Rossa: la riga ha un valore in più rispetto alle 3 colonne ("x"): forse un ";" al posto della virgola decimale'],
    ]);
  });

  it('un file vuoto è un problema', () => {
    expect(planCrewImport('\n\n', CARS, CHAMPIONSHIPS).problems).toEqual([{ line: 1, message: 'il file è vuoto' }]);
  });
});

describe('SQL generato', () => {
  it('inserisce gli equipaggi e i loro campionati rispettando i vincoli del database', () => {
    const database = createMigratedSqliteDatabase();

    const { crews } = planCrewImport(`Nome;Numero;Auto;Campionato;Colore\nRennstall;7;Audi;${FIE};#0055A4\nÉcurie d Or;8;;;`, CARS, CHAMPIONSHIPS);
    database.exec(buildCrewInsertSql(crews, 'import-csv'));

    const savedRows = database
      .prepare('SELECT name, name_key, number, color, created_by_discord_id FROM crews ORDER BY number')
      .all()
      .map((row) => ({ ...row }));
    expect(savedRows).toEqual([
      { name: 'Rennstall', name_key: 'rennstall', number: 7, color: '#0055A4', created_by_discord_id: 'import-csv' },
      { name: 'Écurie d Or', name_key: 'écurie d or', number: 8, color: null, created_by_discord_id: 'import-csv' },
    ]);
    expect(database.prepare('SELECT crew_id, championship, car_id FROM crew_championships').all().map((row) => ({ ...row }))).toEqual([
      { crew_id: 1, championship: FIE, car_id: 1 },
    ]);
  });
});

describe('sostituzione degli equipaggi', () => {
  const existingCrew = (id: number, number: number, name: string, extra: Partial<ExistingCrew> = {}): ExistingCrew => ({
    id,
    number,
    name,
    championships: [],
    color: null,
    usageCount: 0,
    ...extra,
  });

  it('aggiorna per numero (o per nome), tiene i dati non indicati nel file, aggiunge ed elimina', () => {
    const existing = [
      existingCrew(1, 16, 'Vez Team Lime', { championships: [{ championship: FIE, carId: 3 }], color: '#00FF00' }),
      existingCrew(2, 20, 'Vecchio Nome', { championships: [{ championship: JAPAN, carId: 5 }] }),
      existingCrew(3, 77, 'Rinumerato', { championships: [{ championship: FIE, carId: 2 }] }),
      existingCrew(4, 99, 'Prova da togliere'),
      existingCrew(5, 98, 'In classifica', { usageCount: 2 }),
    ];
    const plan = planCrewImport(
      `crew_name;crew_number;car;championship;crew_color\nVez Team Lime;16;;;\nGT Tribe Team Yellow;20;Audi;${FIE};#FFD700\nRinumerato;78;;Nessuno;\nNuovo;5;;;`,
      CARS,
      CHAMPIONSHIPS,
    );
    const sync = planCrewSync(plan, existing);
    expect(sync.problems).toEqual([]);
    // Campionato vuoto: restano quelli salvati; un campionato nuovo si aggiunge agli altri; "Nessuno" li toglie tutti.
    expect(sync.updates.map(({ existing: crew, draft: updated }) => [crew.id, updated.number, updated.name, updated.championships, updated.color])).toEqual([
      [1, 16, 'Vez Team Lime', [{ championship: FIE, carId: 3 }], '#00FF00'],
      [
        2,
        20,
        'GT Tribe Team Yellow',
        [
          { championship: JAPAN, carId: 5 },
          { championship: FIE, carId: 1 },
        ],
        '#FFD700',
      ],
      [3, 78, 'Rinumerato', [], null],
    ]);
    expect(sync.inserts.map((crew) => crew.name)).toEqual(['Nuovo']);
    expect(sync.deletes.map((crew) => crew.id)).toEqual([4]);
    expect(sync.kept.map((crew) => crew.id)).toEqual([5]);
  });

  it('segnala una riga che userebbe il nome o il numero di un equipaggio che resta', () => {
    const existing = [existingCrew(5, 98, 'In classifica', { usageCount: 1 }), existingCrew(6, 12, 'Dodici')];
    // Il numero 98 ritrova proprio l'equipaggio in classifica: nessun problema.
    expect(planCrewSync(planCrewImport('Nome;Numero\nIn classifica;98', CARS, CHAMPIONSHIPS), existing).problems).toEqual([]);
    // Qui la riga aggiorna il #12 dandogli il nome dell'equipaggio in classifica, che però resta.
    expect(planCrewSync(planCrewImport('Nome;Numero\nIn Classifica;12', CARS, CHAMPIONSHIPS), existing).problems).toEqual([
      { line: 2, message: 'In Classifica: nome già usato da "In classifica", che non è nel file ma resta perché compare in ordini di arrivo, penalità o cambi pilota' },
    ]);
  });

  it('applicata al database: nomi scambiati, ordini di arrivo intatti', () => {
    const database = createMigratedSqliteDatabase();
    database.exec(`
      INSERT INTO crews (id, name, name_key, number, color, created_by_discord_id) VALUES
        (1, 'Alfa', 'alfa', 1, '#E10600', 't'),
        (2, 'Beta', 'beta', 2, NULL, 't'),
        (3, 'Gamma', 'gamma', 3, NULL, 't');
      INSERT INTO crew_championships (crew_id, championship, car_id) VALUES (1, 'Cool1 FIE Championship', 3), (2, 'Cool1 FIE Championship', NULL);
      INSERT INTO races (id, championship, round, race_date, created_by_discord_id) VALUES (1, 'Cool1 FIE Championship', 1, '2026-10-01', 't');
      INSERT INTO race_results (race_id, position, crew_id, laps) VALUES (1, 1, 1, 20);
    `);
    const existing = database
      .prepare('SELECT id, name, number, color, (SELECT COUNT(*) FROM race_results WHERE race_results.crew_id = crews.id) AS usageCount FROM crews')
      .all()
      .map((row) => {
        const crew = row as unknown as Omit<ExistingCrew, 'championships'>;
        const championships = database
          .prepare('SELECT championship, car_id AS carId FROM crew_championships WHERE crew_id = ?')
          .all(crew.id)
          .map((entry) => ({ ...entry })) as unknown as ExistingCrew['championships'];
        return { ...crew, championships };
      });
    const sync = planCrewSync(planCrewImport('crew_name;crew_number\nBeta;1\nAlfa;2\nDelta;4', CARS, CHAMPIONSHIPS), existing);
    database.exec(buildCrewSyncSql(sync, 'import-csv'));

    const rows = database.prepare('SELECT id, name, name_key, number, color FROM crews ORDER BY number').all().map((row) => ({ ...row }));
    expect(rows).toEqual([
      { id: 1, name: 'Beta', name_key: 'beta', number: 1, color: '#E10600' },
      { id: 2, name: 'Alfa', name_key: 'alfa', number: 2, color: null },
      { id: 4, name: 'Delta', name_key: 'delta', number: 4, color: null },
    ]);
    // I campionati restano quelli di prima (il file non li indica).
    expect(database.prepare('SELECT crew_id, championship, car_id FROM crew_championships ORDER BY crew_id').all().map((row) => ({ ...row }))).toEqual([
      { crew_id: 1, championship: 'Cool1 FIE Championship', car_id: 3 },
      { crew_id: 2, championship: 'Cool1 FIE Championship', car_id: null },
    ]);
    expect({ ...database.prepare('SELECT crew_id FROM race_results').get() }).toEqual({ crew_id: 1 });
  });
});
