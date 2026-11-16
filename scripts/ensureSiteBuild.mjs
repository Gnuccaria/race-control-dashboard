// Il server serve anche il sito dei risultati (site/dist, vedi server/wrangler.jsonc): se il sito non
// è mai stato compilato, wrangler non partirebbe. Basta una pagina segnaposto; il sito vero si prova
// con `npm run site:dev` e si compila con `npm run site:build` (lo fa da solo `npm run deploy`).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteBuildDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'dist');

if (!existsSync(join(siteBuildDirectory, 'index.html'))) {
  mkdirSync(siteBuildDirectory, { recursive: true });
  writeFileSync(
    join(siteBuildDirectory, 'index.html'),
    '<!doctype html><meta charset="utf-8"><title>Sito non compilato</title><p>Esegui <code>npm run site:build</code> per compilare il sito dei risultati.</p>',
  );
}
