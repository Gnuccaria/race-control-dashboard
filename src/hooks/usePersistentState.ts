import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

function readStorage<T>(key: string, revive: (raw: unknown) => T | null): T | null {
  try {
    const stored = globalThis.localStorage?.getItem(key);
    return stored === null || stored === undefined ? null : revive(JSON.parse(stored));
  } catch {
    return null;
  }
}

/**
 * useState che sopravvive al ricaricamento della pagina (utile durante una gara).
 * `revive` valida i dati letti: se non sono validi si usa `fallback`.
 */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  revive: (raw: unknown) => T | null,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readStorage(key, revive) ?? fallback);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(state));
    } catch {
      // Storage pieno o non disponibile (es. navigazione privata): si continua in memoria.
    }
  }, [key, state]);

  return [state, setState] as const;
}
