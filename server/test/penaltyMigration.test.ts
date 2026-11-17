import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIRECTORY = join(import.meta.dirname, '../migrations');

describe('migrazione 0014: decisione per vettura', () => {
  it('porta la decisione sulle vetture penalizzate e lascia senza decisione "Nessuna azione ulteriore"', () => {
    const database = new DatabaseSync(':memory:');
    database.exec('PRAGMA foreign_keys = ON');
    const migrations = readdirSync(MIGRATIONS_DIRECTORY).sort();
    const runUntil = (lastFile: string) => {
      for (const file of migrations.filter((name) => name <= lastFile)) database.exec(readFileSync(join(MIGRATIONS_DIRECTORY, file), 'utf8'));
    };
    runUntil('0013_penalized_crews.sql');
    database.exec(`
      INSERT INTO crews (id, name, name_key, number, created_by_discord_id) VALUES (1, 'A', 'a', 1, 't'), (2, 'B', 'b', 2, 't');
      INSERT INTO races (id, championship, round, race_date, created_by_discord_id) VALUES (1, 'Cool1 FIE Championship', 1, '2026-11-08', 't');
      INSERT INTO penalties (id, race_id, violation, decision, created_by_discord_id) VALUES (1, 1, 'X', 'time-10', 't'), (2, 1, 'Y', 'no-further-action', 't');
      INSERT INTO penalty_crews (penalty_id, crew_id, is_penalized) VALUES (1, 1, 1), (1, 2, 0), (2, 1, 0), (2, 2, 0);
    `);
    database.exec(readFileSync(join(MIGRATIONS_DIRECTORY, '0014_penalty_decision_per_crew.sql'), 'utf8'));

    const rows = database.prepare('SELECT penalty_id, crew_id, decision FROM penalty_crews ORDER BY penalty_id, crew_id').all().map((row) => ({ ...row }));
    expect(rows).toEqual([
      { penalty_id: 1, crew_id: 1, decision: 'time-10' },
      { penalty_id: 1, crew_id: 2, decision: null },
      { penalty_id: 2, crew_id: 1, decision: null },
      { penalty_id: 2, crew_id: 2, decision: null },
    ]);
    const penaltyColumns = database.prepare('PRAGMA table_info(penalties)').all().map((column) => column.name);
    expect(penaltyColumns.includes('decision')).toBe(false);
  });
});

describe('migrazione 0016: numero dell’articolo e documento', () => {
  it('estrae numero e documento dalle violazioni nella forma solita e lascia le altre come sono', () => {
    const database = new DatabaseSync(':memory:');
    const migrations = readdirSync(MIGRATIONS_DIRECTORY).sort();
    for (const file of migrations.filter((name) => name <= '0015_penalty_english_text.sql')) database.exec(readFileSync(join(MIGRATIONS_DIRECTORY, file), 'utf8'));
    database.exec(`
      INSERT INTO races (id, championship, round, race_date, created_by_discord_id) VALUES (1, 'Cool1 FIE Championship', 1, '2026-11-08', 't');
      INSERT INTO penalties (id, race_id, violation, violation_en, created_by_discord_id) VALUES
        (1, 1, 'Violazione dell’art. 2.5.5.3.1 del C.d.C.', 'Breach', 't'),
        (2, 1, 'Violazione dell''art. 3.1 del Reg. Tec.', NULL, 't'),
        (3, 1, 'Violazione degli artt. 3.1, 3.2 del Reg. Tec.', NULL, 't'),
        (4, 1, 'Contatto in curva 1', NULL, 't');
    `);
    database.exec(readFileSync(join(MIGRATIONS_DIRECTORY, '0016_penalty_article_and_document.sql'), 'utf8'));

    const rows = database.prepare('SELECT id, violation, document FROM penalties ORDER BY id').all().map((row) => ({ ...row }));
    expect(rows).toEqual([
      { id: 1, violation: '2.5.5.3.1', document: 'code-of-conduct' },
      { id: 2, violation: '3.1', document: 'technical-regulations' },
      { id: 3, violation: 'Violazione degli artt. 3.1, 3.2 del Reg. Tec.', document: 'technical-regulations' },
      { id: 4, violation: 'Contatto in curva 1', document: 'code-of-conduct' },
    ]);
    const penaltyColumns = database.prepare('PRAGMA table_info(penalties)').all().map((column) => column.name);
    expect(penaltyColumns.includes('violation_en')).toBe(false);
  });
});
