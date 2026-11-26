import type { ServerApiResult } from '@/services/serverApi';
import { useBulkDelete } from './useBulkDelete';
import { useRowSelection } from './useRowSelection';

/**
 * Elenco con righe selezionabili (clic destro) ed eliminazione delle selezionate: a eliminazione riuscita la selezione
 * si svuota e la pagina rilegge l'elenco (onDeleted). Lo usano gli elenchi di equipaggi, campionati e gare.
 */
export function useSelectionDelete(deleteOnServer: (ids: readonly number[]) => Promise<ServerApiResult<number>>, onDeleted: () => void) {
  const { selectedIds, toggleSelection, clearSelection } = useRowSelection();
  const { deleteState, isDeleting, deleteSelected } = useBulkDelete(deleteOnServer, () => {
    clearSelection();
    onDeleted();
  });
  return {
    selectedIds,
    toggleSelection,
    deleteState,
    isDeleting,
    deleteSelected,
    /** Righe selezionate tra quelle indicate (es. solo quelle visibili con i filtri correnti). */
    selectedAmong: <Row extends { readonly id: number }>(rows: readonly Row[]): Row[] => rows.filter((row) => selectedIds.has(row.id)),
  };
}
