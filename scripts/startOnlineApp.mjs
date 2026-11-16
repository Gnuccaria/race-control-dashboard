// `npm run desktop:dev:online`: avvia l'app in sviluppo collegata al server su Cloudflare,
// senza server locale. L'indirizzo è quello di .env.production (lo stesso dell'installer),
// così è scritto in un solo posto.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const productionEnvPath = join(projectDirectory, '.env.production');

const onlineServerUrl = existsSync(productionEnvPath)
  ? /^\s*VITE_CREW_API_URL\s*=\s*(\S+)\s*$/m.exec(readFileSync(productionEnvPath, 'utf8'))?.[1]
  : undefined;

if (!onlineServerUrl) {
  console.error(
    '\n✖ Manca l’indirizzo del server online.\n' +
      '  Crea nella cartella principale il file .env.production con la riga:\n' +
      '  VITE_CREW_API_URL=https://race-control-api.<tuo-sottodominio>.workers.dev\n',
  );
  process.exit(1);
}

console.log(`App collegata al server online: ${onlineServerUrl}\n`);
// Vite legge anche le variabili VITE_* dell'ambiente: tauri dev le passa a `npm run dev`.
const appProcess = spawnSync('npx', ['tauri', 'dev'], {
  cwd: projectDirectory,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_CREW_API_URL: onlineServerUrl },
});
process.exit(appProcess.status ?? 0);
