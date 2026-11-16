import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'site/dist', 'coverage', 'src-tauri']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strict,
      tseslint.configs.stylistic,
      // Include anche le regole del React Compiler (purezza, immutabilità, ...).
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
  {
    // Pagine del sito caricate su richiesta dal router: esportano anche loader e pagina d'errore.
    files: ['site/src/pages/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': ['warn', { allowExportNames: ['loader', 'shouldRevalidate', 'ErrorBoundary'] }],
    },
  },
]);
