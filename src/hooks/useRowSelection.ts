import { useState } from 'react';

/** Righe selezionate (con il tasto destro) in un elenco, per id. */
export function useRowSelection() {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());

  return {
    selectedIds,
    /** Primo clic destro seleziona, il successivo deseleziona. */
    toggleSelection: (rowId: number) => {
      setSelectedIds((previousIds) => {
        const nextIds = new Set(previousIds);
        if (nextIds.has(rowId)) nextIds.delete(rowId);
        else nextIds.add(rowId);
        return nextIds;
      });
    },
    clearSelection: () => {
      setSelectedIds(new Set());
    },
  };
}
