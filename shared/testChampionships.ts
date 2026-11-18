import type { Championship } from './championshipRules';
import { DEFAULT_SESSION_SETTINGS } from './sessionSettingsRules';

/**
 * Solo per i test (app, server e regole condivise): i due campionati inseriti dalla migrazione 0028, con le stesse
 * durate e gli stessi stint (Cool1 FIE 6 ore/60 min e 12 ore/120 min = 5 cambi; All Japan GT 3 ore/90 min = 1 cambio).
 * Vetture ammesse come in src/test/testCars.ts: tutte nel Cool1 FIE, la Nissan (id 5) anche nell'All Japan GT.
 */
export const TEST_CHAMPIONSHIPS: Championship[] = [
  { id: 2, name: 'All Japan GT Championship', durations: [{ hours: 3, stintMinutes: 90 }], carIds: [5], createdAt: '2026-11-01T00:00:00Z', sessionSettings: DEFAULT_SESSION_SETTINGS },
  {
    id: 1,
    name: 'Cool1 FIE Championship',
    durations: [
      { hours: 6, stintMinutes: 60 },
      { hours: 12, stintMinutes: 120 },
    ],
    carIds: [1, 2, 3, 4, 5, 6],
    createdAt: '2026-11-01T00:00:00Z',
    sessionSettings: DEFAULT_SESSION_SETTINGS,
  },
];
