import { defineConfig } from 'vitest/config';

// I test girano in Node con un database SQLite reale in memoria (node:sqlite),
// che espone la stessa interfaccia usata dal server su D1.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', '../shared/**/*.test.ts'],
  },
});
