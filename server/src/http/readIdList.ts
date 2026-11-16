/** Limite per singola richiesta di eliminazione (il corpo resta comunque sotto i 2 KB). */
const MAX_IDS_PER_REQUEST = 200;

const isPositiveId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

/** { "ids": [1, 2, 3] } → id unici; null se il corpo non ha questa forma. */
export function readIdList(requestBody: unknown): number[] | null {
  const ids = (requestBody as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS_PER_REQUEST || !ids.every(isPositiveId)) return null;
  return [...new Set(ids)];
}
