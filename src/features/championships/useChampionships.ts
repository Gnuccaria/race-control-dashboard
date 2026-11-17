import type { Championship } from '@shared/championshipRules';
import { useServerQuery } from '@/hooks/useServerQuery';
import { fetchChampionships } from './services/championshipApi';

/**
 * Campionati letti dal server per i menu di gare ed equipaggi (nomi, durate, vetture ammesse).
 * Come le auto, si ricaricano (refresh) quando l'utente apre un menu, così un campionato appena creato compare subito.
 */
export function useChampionships() {
  const { queryState, reload } = useServerQuery('championships', fetchChampionships);
  const championships: readonly Championship[] = queryState.status === 'loaded' ? queryState.value : [];
  return {
    championships,
    isLoading: queryState.status === 'loading',
    errorKind: queryState.status === 'failed' ? queryState.errorKind : null,
    refresh: reload,
  };
}

export type ChampionshipCatalog = ReturnType<typeof useChampionships>;
