export type RaceFormTab = 'info' | 'qualifying' | 'results' | 'driverSwaps';

/**
 * Schede di "Gestisci ordini di arrivo" (dettaglio e creazione). I Cambi pilota hanno uno strumento a parte,
 * "Gestisci cambi pilota" dei Commissari Sportivi, che mostra solo quella scheda. Le penalità non hanno più una
 * scheda: nascono accogliendo una protesta (Gestisci proteste) e vanno nel referto.
 */
export const RESULTS_TABS: readonly RaceFormTab[] = ['info', 'qualifying', 'results'];
export const DRIVER_SWAP_TABS: readonly RaceFormTab[] = ['driverSwaps'];
