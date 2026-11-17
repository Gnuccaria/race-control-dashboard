import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Su Cloudflare il sito e le API hanno lo stesso indirizzo: le richieste passano dal codice del server solo se il
 * percorso è in assets.run_worker_first di wrangler.jsonc, altrimenti risponde il sito (e l'app riceve una pagina HTML).
 */
const wranglerText = readFileSync(join(import.meta.dirname, '../wrangler.jsonc'), 'utf8');
const appText = readFileSync(join(import.meta.dirname, '../src/app.ts'), 'utf8');

/** JSON con commenti → oggetto (i commenti stanno su righe a sé, come nel file). */
const wrangler = JSON.parse(wranglerText.replace(/^\s*\/\/.*$/gm, '')) as { assets: { run_worker_first: string[] } };
const workerFirst = wrangler.assets.run_worker_first.map((pattern) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`));
const reachesWorker = (path: string) => workerFirst.some((pattern) => pattern.test(path));

describe('percorsi delle API su Cloudflare', () => {
  it('ogni risorsa e ogni percorso dichiarato in app.ts passa dal codice del server', () => {
    const resourcesBlock = /const resources: Record<string, ResourceRoutes> = \{([\s\S]*?)\n {2}\};/.exec(appText)?.[1] ?? '';
    const resources = [...resourcesBlock.matchAll(/^ {4}(\w+): \{$/gm)].map((match) => `/${match[1]}`);
    expect(resources).toEqual(expect.arrayContaining(['/crews', '/races', '/championships', '/tracks', '/cars']));
    const literalPaths = [...appText.matchAll(/'(\/[a-z][a-z/-]*)'/g)].map((match) => match[1] ?? '').filter((path) => path !== '/');
    const missing = [...resources, ...resources.map((path) => `${path}/1`), ...literalPaths].filter((path) => !reachesWorker(path));
    expect(missing).toEqual([]);
  });

  it('le pagine del sito restano al sito', () => {
    expect(reachesWorker('/')).toBe(false);
    expect(reachesWorker('/gare/3')).toBe(false);
  });
});
