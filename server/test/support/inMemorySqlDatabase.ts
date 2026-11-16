import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqlDatabase, SqlStatement } from '../../src/database/sqlDatabase';

const MIGRATIONS_DIRECTORY = join(import.meta.dirname, '../../migrations');

/** SQLite reale in memoria con le migrazioni del progetto applicate, per eseguire SQL grezzo. */
export function createMigratedSqliteDatabase(): DatabaseSync {
  const sqliteDatabase = new DatabaseSync(':memory:');
  // Come D1, che applica sempre i vincoli di chiave esterna.
  sqliteDatabase.exec('PRAGMA foreign_keys = ON');
  for (const migrationFile of readdirSync(MIGRATIONS_DIRECTORY).sort()) {
    sqliteDatabase.exec(readFileSync(join(MIGRATIONS_DIRECTORY, migrationFile), 'utf8'));
  }
  return sqliteDatabase;
}

interface InMemoryStatement extends SqlStatement {
  /** Esecuzione sincrona, usata da batch() dentro la transazione. */
  readonly runSync: () => Record<string, unknown>[];
}

/** Lo stesso database dietro l'interfaccia usata dal server su D1. */
export function createInMemorySqlDatabase(): SqlDatabase {
  const sqliteDatabase = createMigratedSqliteDatabase();

  const prepareStatement = (query: string, boundValues: unknown[] = []): InMemoryStatement => {
    // node:sqlite restituisce oggetti senza prototipo: li copiamo per averli come quelli di D1.
    const runSync = () =>
      sqliteDatabase
        .prepare(query)
        .all(...(boundValues as SQLInputValue[]))
        .map((row) => ({ ...row }));
    return {
      runSync,
      bind: (...values) => prepareStatement(query, values),
      first: <Row>() => Promise.resolve((runSync()[0] as Row | undefined) ?? null),
      all: <Row>() => Promise.resolve({ results: runSync() as Row[] }),
      run: () => Promise.resolve(sqliteDatabase.prepare(query).run(...(boundValues as SQLInputValue[]))),
    };
  };

  return {
    prepare: (query) => prepareStatement(query),
    batch: <Row>(statements: SqlStatement[]) => {
      sqliteDatabase.exec('BEGIN');
      try {
        const batchResults = statements.map((statement) => ({ results: (statement as InMemoryStatement).runSync() as Row[] }));
        sqliteDatabase.exec('COMMIT');
        return Promise.resolve(batchResults);
      } catch (statementError) {
        sqliteDatabase.exec('ROLLBACK');
        return Promise.reject(statementError instanceof Error ? statementError : new Error(String(statementError)));
      }
    },
  };
}
