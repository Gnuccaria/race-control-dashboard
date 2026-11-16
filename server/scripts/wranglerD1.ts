/**
 * Accesso al database D1 dagli script di importazione, tramite wrangler:
 * sempre il database online su Cloudflare.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ImportProblem } from '../src/import/csv';

const DATABASE_NAME = 'race-control';

export interface ImportCommandLine {
  readonly csvPath: string;
  readonly isDryRun: boolean;
}

/** "1 equipaggio", "3 equipaggi". */
export const countLabel = (count: number, singular: string, plural: string): string => `${count} ${count === 1 ? singular : plural}`;

export function exitWithError(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/** Legge percorso del file e opzioni; usage = esempio di comando mostrato se manca il file. */
export function readImportCommandLine(usage: string): ImportCommandLine {
  const commandLineArguments = process.argv.slice(2);
  const csvPath = commandLineArguments.find((argument) => !argument.startsWith('--'));
  if (!csvPath) exitWithError(`Indica il file CSV, es.: ${usage} [--dry-run]`);
  return { csvPath, isDryRun: commandLineArguments.includes('--dry-run') };
}

export function readCsvFile(csvPath: string): string {
  try {
    return readFileSync(csvPath, 'utf8');
  } catch {
    exitWithError(`Impossibile leggere il file "${csvPath}".`);
  }
}

export function exitWithProblems(problems: readonly ImportProblem[], what: string): never {
  console.error(`\nTrovati ${problems.length} problemi, ${what}:\n`);
  for (const problem of problems) console.error(`  riga ${problem.line}: ${problem.message}`);
  exitWithError('Correggi il file e rilancia il comando.');
}

export function createD1Client() {
  /** Esegue wrangler d1 execute e restituisce l'output JSON. */
  function execute(extraArguments: string[]): unknown {
    const wranglerArguments = ['wrangler', 'd1', 'execute', DATABASE_NAME, '--remote', '--json', '--yes', ...extraArguments];
    // shell: true per trovare npx anche su Windows (npx.cmd); gli argomenti con spazi sono tra virgolette.
    const result = spawnSync('npx', wranglerArguments, { shell: true, encoding: 'utf8' });
    if (result.status !== 0) exitWithError(`wrangler ha restituito un errore:\n${result.stderr || result.stdout}`);
    // Sul database online wrangler scrive prima l'avanzamento ("├ Uploading…"), poi il JSON:
    // si legge dalla prima riga che apre un elenco o un oggetto.
    const jsonStart = result.stdout.search(/^\s*[[{]/m);
    try {
      return JSON.parse(jsonStart >= 0 ? result.stdout.slice(jsonStart) : result.stdout);
    } catch {
      exitWithError(`Risposta di wrangler non leggibile:\n${result.stdout}`);
    }
  }

  return {
    /** Righe restituite da una SELECT (senza virgolette doppie nel testo). */
    select<Row>(selectQuery: string): Row[] {
      const output = execute(['--command', `"${selectQuery}"`]);
      return (Array.isArray(output) ? output : [output]).flatMap((statementResult: { results?: Row[] }) => statementResult.results ?? []);
    },
    /** Esegue un elenco di istruzioni SQL passandole come file temporaneo. */
    executeSql(sqlText: string): void {
      const temporaryDirectory = mkdtempSync(join(tmpdir(), 'race-control-import-'));
      const sqlFilePath = join(temporaryDirectory, 'import.sql');
      try {
        writeFileSync(sqlFilePath, sqlText);
        execute(['--file', `"${sqlFilePath}"`]);
      } finally {
        rmSync(temporaryDirectory, { recursive: true, force: true });
      }
    },
  };
}
