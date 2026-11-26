/**
 * Controlli di base sui dati di origine sconosciuta (corpo delle richieste, JSON salvati), comuni a tutte le regole
 * di shared/: app, sito e server li usano allo stesso modo.
 */

/** Intero maggiore di zero (id, posizioni, numero del cambio pilota, ...). */
export const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

/** È un oggetto (non null)? */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Campi di un oggetto di origine sconosciuta; un valore che non è un oggetto vale come oggetto vuoto. */
export const fieldsOf = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

/** Forma canonica di un testo scritto a mano: caratteri composti (NFC), niente spazi ai bordi, spazi multipli ridotti a uno. */
export const normalizeSpaces = (rawText: string): string => rawText.normalize('NFC').trim().replace(/\s+/g, ' ');
