/**
 * Sottoinsieme dell'API di Cloudflare D1 usato dal server. Dichiararlo qui permette
 * di eseguire i test con SQLite reale in Node, senza dipendere dal runtime di Cloudflare.
 */
export interface SqlStatement {
  bind(...values: unknown[]): SqlStatement;
  first<Row = Record<string, unknown>>(): Promise<Row | null>;
  all<Row = Record<string, unknown>>(): Promise<{ results: Row[] }>;
  run(): Promise<unknown>;
}

export interface SqlDatabase {
  prepare(query: string): SqlStatement;
  /** Esegue più istruzioni in un'unica transazione: o vanno a buon fine tutte, o nessuna. */
  batch<Row = Record<string, unknown>>(statements: SqlStatement[]): Promise<{ results: Row[] }[]>;
}

/** SQLite (e quindi D1) segnala la violazione di un vincolo UNIQUE con questo testo. */
export function isUniqueConstraintError(caughtError: unknown): boolean {
  return caughtError instanceof Error && caughtError.message.includes('UNIQUE constraint failed');
}
