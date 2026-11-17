/// <reference types="vitest/config" />
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

/** Impostato dalla CLI di Tauri solo per lo sviluppo su dispositivi esterni. */
const tauriDevHost = process.env.TAURI_DEV_HOST;
const isTauriDebugBuild = Boolean(process.env.TAURI_ENV_DEBUG);

/**
 * Indirizzo del server su Cloudflare, da .env.production: lo usano sia l'installer sia `npm run desktop:dev` e
 * `npm run dev`, perché i dati sono solo quelli online. Nei test non serve (le chiamate sono simulate).
 */
function readOnlineServerUrl(mode: string): string | undefined {
  const onlineServerUrl = loadEnv('production', fileURLToPath(new URL('.', import.meta.url)), 'VITE_').VITE_CREW_API_URL;
  if (!onlineServerUrl && mode !== 'test') {
    throw new Error(
      "Manca l'indirizzo del server online: crea nella cartella principale il file .env.production con la riga\n" +
        'VITE_CREW_API_URL=https://race-control-api.<tuo-sottodominio>.workers.dev',
    );
  }
  return onlineServerUrl;
}

export default defineConfig(({ mode }) => {
  const onlineServerUrl = readOnlineServerUrl(mode);
  return {
    define: onlineServerUrl ? { 'import.meta.env.VITE_CREW_API_URL': JSON.stringify(onlineServerUrl) } : {},
    // Vite 8 + @vitejs/plugin-react v6 (Oxc). Il React Compiler gira tramite
    // @rolldown/plugin-babel e applica in automatico la memoizzazione.
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    resolve: {
      // Vite 8 legge direttamente i "paths" di tsconfig (alias @/ → src/).
      tsconfigPaths: true,
    },
    // Non cancella il terminale: gli errori di compilazione Rust restano visibili.
    clearScreen: false,
    server: {
      // Deve coincidere con build.devUrl in src-tauri/tauri.conf.json.
      port: 5173,
      // Tauri si aspetta una porta fissa: meglio fallire che cambiarla in silenzio.
      strictPort: true,
      host: tauriDevHost ?? false,
      hmr: tauriDevHost ? { protocol: 'ws', host: tauriDevHost, port: 1421 } : undefined,
      watch: {
        ignored: ['**/src-tauri/**'],
      },
    },
    envPrefix: ['VITE_', 'TAURI_ENV_*'],
    build: {
      // Tauri usa WebView2 (Chromium) su Windows e WebKit su macOS e Linux.
      target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
      minify: !isTauriDebugBuild,
      sourcemap: isTauriDebugBuild,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: { modules: { classNameStrategy: 'non-scoped' } },
      restoreMocks: true,
      // Da Vitest 3 restoreMocks non azzera più le chiamate dei mock di vi.mock: le azzera clearMocks.
      clearMocks: true,
      // I test del server girano con la loro configurazione (cd server && npm run test:run): usano node:sqlite.
      exclude: ['**/node_modules/**', 'server/**', 'src-tauri/**'],
    },
  };
});
