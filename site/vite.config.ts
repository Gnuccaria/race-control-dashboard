import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const fromProject = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
/**
 * Server da cui il sito in sviluppo (`npm run site:dev`) legge le API pubbliche (/public/…): quello su
 * Cloudflare, con le gare vere, all'indirizzo di .env.production (lo stesso dell'app, scritto in un solo posto).
 */
function resolveApiTarget(): string {
  const onlineServerUrl = loadEnv('production', fromProject(''), 'VITE_').VITE_CREW_API_URL;
  if (!onlineServerUrl) {
    throw new Error(
      'Manca l\'indirizzo del server online: crea nella cartella principale il file .env.production con la riga\n' +
        'VITE_CREW_API_URL=https://race-control-api.<tuo-sottodominio>.workers.dev',
    );
  }
  return onlineServerUrl;
}

/**
 * Sito pubblico dei risultati. Riusa componenti, stili e testi dell'app (alias @ e @shared) e legge
 * i dati dalle API pubbliche del server. In produzione il sito è servito dallo stesso server, quindi
 * stesso indirizzo; in sviluppo Vite inoltra le richieste /public al server scelto sopra.
 */
export default defineConfig(({ command }) => {
  // La build non chiama il server: l'indirizzo serve solo a site:dev e site:preview.
  const publicApiProxy = command === 'build' ? undefined : { '/public': { target: resolveApiTarget(), changeOrigin: true } };
  return {
    root: fromProject('site'),
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    resolve: {
      alias: {
        '@site': fromProject('site/src'),
        '@shared': fromProject('shared'),
        '@': fromProject('src'),
      },
    },
    server: { port: 5174, proxy: publicApiProxy },
    preview: { port: 5174, proxy: publicApiProxy },
    build: {
      outDir: fromProject('site/dist'),
      emptyOutDir: true,
      target: 'es2022',
    },
  };
});
