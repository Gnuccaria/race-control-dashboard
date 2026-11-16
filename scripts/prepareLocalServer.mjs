// Eseguito da npm prima di `npm run desktop:dev` e di `npm run server:dev`, prepara il server locale:
// 1. se mancano le dipendenze del server (prima volta, o progetto appena estratto) le installa;
// 2. applica al database locale le migrazioni non ancora applicate (crea la tabella degli
//    equipaggi o la aggiorna). Se sono già tutte applicate non fa nulla.
// Così `desktop:dev` avvia server e app insieme senza passaggi manuali.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import './ensureSiteBuild.mjs';

const serverDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'server');

function runInServer(description, command, commandArguments) {
  console.log(description);
  const result = spawnSync(command, commandArguments, {
    cwd: serverDirectory,
    stdio: 'inherit',
    // shell: true per trovare npm/npx anche su Windows (npm.cmd).
    shell: true,
    // CI=true: wrangler non chiede conferme (qui nessuno potrebbe rispondere).
    env: { ...process.env, CI: 'true' },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(join(serverDirectory, 'node_modules'))) {
  runInServer('Prima installazione delle dipendenze del server…', 'npm', ['install']);
}

runInServer('Aggiornamento del database locale degli equipaggi…', 'npx', ['wrangler', 'd1', 'migrations', 'apply', 'race-control', '--local']);
