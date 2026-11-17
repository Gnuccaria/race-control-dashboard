export type RaceFormTab = 'info' | 'results' | 'driverSwaps' | 'penalties';

/**
 * Schede di "Gestisci ordini di arrivo" (dettaglio e creazione). I Cambi pilota hanno uno strumento a parte,
 * "Gestisci cambi pilota" dei Commissari Sportivi, che mostra solo quella scheda.
 */
export const RESULTS_TABS: readonly RaceFormTab[] = ['info', 'results', 'penalties'];
export const DRIVER_SWAP_TABS: readonly RaceFormTab[] = ['driverSwaps'];
