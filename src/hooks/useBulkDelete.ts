import { startTransition, useActionState } from 'react';
import type { ServerApiResult, ServerErrorKind } from '@/services/serverApi';

export type BulkDeleteState =
  | { readonly status: 'idle' }
  | { readonly status: 'deleted'; readonly deletedCount: number }
  | { readonly status: 'failed'; readonly errorKind: ServerErrorKind };

/** Eliminazione delle righe selezionate; a operazione riuscita l'elenco viene riletto dal server. */
export function useBulkDelete(
  deleteOnServer: (ids: readonly number[]) => Promise<ServerApiResult<number>>,
  onDeleted: () => void,
) {
  const [deleteState, dispatchDelete, isDeleting] = useActionState<BulkDeleteState, readonly number[]>(
    async (_previousState, ids) => {
      const deleteResult = await deleteOnServer(ids);
      if (!deleteResult.isSuccess) return { status: 'failed', errorKind: deleteResult.errorKind };
      onDeleted();
      return { status: 'deleted', deletedCount: deleteResult.value };
    },
    { status: 'idle' },
  );

  return {
    deleteState,
    isDeleting,
    deleteSelected: (ids: readonly number[]) => {
      startTransition(() => {
        dispatchDelete(ids);
      });
    },
  };
}
