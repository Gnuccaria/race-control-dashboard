import { useEffect, useEffectEvent, useState } from 'react';
import type { ServerApiResult, ServerErrorKind } from '@/services/serverApi';

export type ServerQueryState<Value> =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly value: Value; readonly isRefreshing: boolean }
  | { readonly status: 'failed'; readonly errorKind: ServerErrorKind };

interface SettledQuery<Value> {
  readonly queryKey: string;
  readonly requestKey: string;
  readonly result: ServerApiResult<Value>;
}

/**
 * Lettura dal server con stato di caricamento, errore e ricaricamento.
 * Ogni richiesta ha una chiave (query + numero di tentativi): una risposta arrivata in ritardo
 * per una chiave vecchia viene ignorata. Durante un ricaricamento i dati già mostrati restano
 * a schermo (isRefreshing), così filtri e ordinamento dell'elenco non si perdono.
 */
export function useServerQuery<Value>(queryKey: string, runQuery: () => Promise<ServerApiResult<Value>>) {
  const [attempt, setAttempt] = useState(0);
  const [settledQuery, setSettledQuery] = useState<SettledQuery<Value> | null>(null);
  const requestKey = `${queryKey}#${attempt}`;

  const startQuery = useEffectEvent(() => runQuery());

  useEffect(() => {
    let isCurrentRequest = true;
    void startQuery().then((result) => {
      if (isCurrentRequest) setSettledQuery({ queryKey, requestKey, result });
    });
    return () => {
      isCurrentRequest = false;
    };
  }, [queryKey, requestKey]);

  let queryState: ServerQueryState<Value> = { status: 'loading' };
  if (settledQuery?.queryKey === queryKey) {
    const isRefreshing = settledQuery.requestKey !== requestKey;
    if (settledQuery.result.isSuccess) {
      queryState = { status: 'loaded', value: settledQuery.result.value, isRefreshing };
    } else if (!isRefreshing) {
      queryState = { status: 'failed', errorKind: settledQuery.result.errorKind };
    }
  }

  return {
    queryState,
    /** Rilegge dal server: dopo un errore ("Riprova") o dopo una modifica (es. un'eliminazione). */
    reload: () => {
      setAttempt((previousAttempt) => previousAttempt + 1);
    },
    /** Dopo un salvataggio: mostra subito il valore aggiornato senza rileggerlo dal server. */
    replaceValue: (value: Value) => {
      setSettledQuery({ queryKey, requestKey, result: { isSuccess: true, value } });
    },
  };
}
