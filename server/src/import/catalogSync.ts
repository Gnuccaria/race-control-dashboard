/**
 * Sostituzione di un elenco (auto, piste) con quello di un file, senza rompere i collegamenti:
 * le righe con lo stesso nome vengono aggiornate tenendo il loro id (a cui puntano equipaggi e gare),
 * quelle nuove aggiunte, quelle sparite eliminate. Una riga sparita ma ancora in uso non si elimina:
 * resta, e viene segnalata, finché non la si sostituisce nell'app.
 */

export interface ExistingCatalogRow {
  readonly id: number;
  /** Quanti equipaggi (per le auto) o gare (per le piste) la usano. */
  readonly usageCount: number;
}

export interface CatalogSyncPlan<Draft, Existing extends ExistingCatalogRow> {
  readonly inserts: readonly Draft[];
  readonly updates: readonly { readonly existing: Existing; readonly draft: Draft }[];
  readonly deletes: readonly Existing[];
  /** Assenti dal file ma ancora in uso: restano nel database. */
  readonly kept: readonly Existing[];
}

export function planCatalogSync<Draft, Existing extends ExistingCatalogRow>(
  drafts: readonly Draft[],
  existingRows: readonly Existing[],
  keyOfDraft: (draft: Draft) => string,
  keyOfExisting: (existing: Existing) => string,
  /** Seconda possibilità per una riga senza corrispondenza esatta (vedi le auto senza modello). */
  findFallbackDraft?: (existing: Existing, unmatchedDrafts: readonly Draft[]) => Draft | undefined,
): CatalogSyncPlan<Draft, Existing> {
  const draftByKey = new Map(drafts.map((draft) => [keyOfDraft(draft), draft]));
  const matchedDrafts = new Set<Draft>();
  const updates: { existing: Existing; draft: Draft }[] = [];
  const unmatchedExisting: Existing[] = [];

  for (const existing of existingRows) {
    const draft = draftByKey.get(keyOfExisting(existing));
    if (draft) {
      matchedDrafts.add(draft);
      updates.push({ existing, draft });
    } else unmatchedExisting.push(existing);
  }

  const deletes: Existing[] = [];
  const kept: Existing[] = [];
  for (const existing of unmatchedExisting) {
    const fallbackDraft = findFallbackDraft?.(existing, drafts.filter((draft) => !matchedDrafts.has(draft)));
    if (fallbackDraft) {
      matchedDrafts.add(fallbackDraft);
      updates.push({ existing, draft: fallbackDraft });
    } else if (existing.usageCount > 0) kept.push(existing);
    else deletes.push(existing);
  }

  return { inserts: drafts.filter((draft) => !matchedDrafts.has(draft)), updates, deletes, kept };
}
