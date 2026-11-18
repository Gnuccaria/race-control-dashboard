import type { LegacyTrackMatch, TrackMapMatch, TrackRefreshPreview } from '@shared/trackRules';
import { startTransition, useActionState, useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Button } from '@/components/ui/Button/Button';
import { Panel } from '@/components/ui/Panel/Panel';
import { Select } from '@/components/ui/Select/Select';
import { useI18n } from '@/i18n/useI18n';
import type { ServerErrorKind } from '@/services/serverApi';
import { serverErrorText } from '@/services/serverErrorText';
import { refreshTracks } from '../trackApi';
import styles from '../ManageTracksPage.module.css';

/** Scelta "nessuna" nei menu degli abbinamenti. */
const NONE = '__none';

interface Choices {
  readonly mapMatches: readonly TrackMapMatch[];
  readonly legacyMatches: readonly LegacyTrackMatch[];
}

type RefreshState =
  | { readonly status: 'idle' }
  | { readonly status: 'preview'; readonly preview: TrackRefreshPreview; readonly sentChoices: Choices }
  | { readonly status: 'saved'; readonly preview: TrackRefreshPreview }
  | { readonly status: 'failed'; readonly errorKind: ServerErrorKind; readonly preview: TrackRefreshPreview | null };

/** refetch: true solo per "Aggiorna dati" (riscarica i siti); ricalcolo e invio riusano i dati dell'anteprima. */
type RefreshAction = ({ readonly apply: boolean; readonly refetch: boolean } & Choices) | { readonly close: true };

const sameChoices = (first: Choices, second: Choices) =>
  JSON.stringify([first.mapMatches, first.legacyMatches]) === JSON.stringify([second.mapMatches, second.legacyMatches]);

/**
 * Aggiornamento manuale dei tracciati: "Aggiorna dati" chiede al server di leggere il wiki di Gran Turismo e le mappe di
 * gt-engine.com e mostra l'anteprima. I vecchi tracciati usati da gare senza corrispondenza e le configurazioni senza
 * mappa si abbinano a mano (o "nessuna") e l'anteprima si ricalcola; "Invia al server" salva, dopo una conferma.
 */
export function TrackRefreshPanel({ onSaved }: { readonly onSaved: () => void }) {
  const { messages } = useI18n();
  const texts = messages.manageTracks.refresh;
  const [choices, setChoices] = useState<Choices>({ mapMatches: [], legacyMatches: [] });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [state, dispatch, isWorking] = useActionState<RefreshState, RefreshAction>(async (previousState, action) => {
    if ('close' in action) return { status: 'idle' };
    const currentPreview = 'preview' in previousState ? previousState.preview : null;
    const result = await refreshTracks(action);
    if (!result.isSuccess) return { status: 'failed', errorKind: result.errorKind, preview: currentPreview };
    if (action.apply) {
      onSaved();
      return { status: 'saved', preview: result.value.preview };
    }
    return { status: 'preview', preview: result.value.preview, sentChoices: { mapMatches: action.mapMatches, legacyMatches: action.legacyMatches } };
  }, { status: 'idle' });

  const run = (action: RefreshAction) => {
    startTransition(() => {
      dispatch(action);
    });
  };
  const preview = state.status === 'preview' || state.status === 'failed' ? state.preview : null;
  const isPreviewCurrent = state.status === 'preview' && sameChoices(state.sentChoices, choices);
  const chooseMap = (sourceKey: string, value: string) => {
    setChoices((previous) => {
      const others = previous.mapMatches.filter((match) => match.sourceKey !== sourceKey);
      return { ...previous, mapMatches: value === '' ? others : [...others, { sourceKey, mapFile: value === NONE ? null : value }] };
    });
  };
  const chooseLayout = (trackId: number, value: string) => {
    setChoices((previous) => {
      const others = previous.legacyMatches.filter((match) => match.trackId !== trackId);
      return { ...previous, legacyMatches: value === '' ? others : [...others, { trackId, sourceKey: value === NONE ? null : value }] };
    });
  };

  return (
    <Panel title={texts.title} description={texts.description}>
      <div className={styles.refresh}>
        {state.status === 'saved' && <InlineAlert tone="success">{texts.saved(state.preview.inserted.length, state.preview.updated.length, state.preview.deleted.length)}</InlineAlert>}
        {state.status === 'failed' && <InlineAlert>{serverErrorText(messages, state.errorKind)}</InlineAlert>}

        {preview ? (
          <>
            <p className={styles.previewTitle}>{texts.previewTitle}</p>
            <ul className={styles.summary}>
              <li>{texts.trackCount(preview.trackCount)}</li>
              <li>{texts.inserted(preview.inserted.length)}</li>
              <li>{texts.updated(preview.updated.length)}</li>
              <li>{texts.deleted(preview.deleted.length)}</li>
              {preview.kept.length > 0 && <li>{texts.kept(preview.kept.join(', '))}</li>}
            </ul>
            {preview.updated.length > 0 && (
              <details className={styles.details}>
                <summary>{texts.showUpdated}</summary>
                <ul>
                  {preview.updated.map((change) => (
                    <li key={change.name}>
                      <strong>{change.name}</strong>
                      {change.changes.length > 0 && ': '}
                      {change.changes.map((fieldChange) => `${texts.fields[fieldChange.field]} ${String(fieldChange.before ?? '–')} → ${String(fieldChange.after ?? '–')}`).join(' · ')}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {preview.inserted.length > 0 && (
              <details className={styles.details}>
                <summary>{texts.showInserted}</summary>
                <p>{preview.inserted.join(', ')}</p>
              </details>
            )}
            {preview.deleted.length > 0 && (
              <details className={styles.details}>
                <summary>{texts.showDeleted}</summary>
                <p>{preview.deleted.join(', ')}</p>
              </details>
            )}

            {preview.unmatchedLegacy.length > 0 && (
              <section className={styles.matches} aria-labelledby="legacy-tracks-title">
                <h3 id="legacy-tracks-title" className={styles.previewTitle}>
                  {texts.legacyTitle}
                </h3>
                <p className={styles.hint}>{texts.legacyHint}</p>
                <ul className={styles.matchList}>
                  {preview.unmatchedLegacy.map((track) => {
                    const chosen = choices.legacyMatches.find((match) => match.trackId === track.trackId);
                    const value = chosen === undefined ? '' : chosen.sourceKey === null ? NONE : chosen.sourceKey;
                    return (
                      <li key={track.trackId} className={styles.matchRow}>
                        <span>
                          {track.name} <span className={styles.hint}>({texts.legacyUsage(track.usageCount)})</span>
                        </span>
                        <Select
                          aria-label={texts.legacyFor(track.name)}
                          placeholderLabel={texts.chooseLayout}
                          value={value}
                          options={[{ value: NONE, label: texts.noLayout }, ...preview.layouts.map((layout) => ({ value: layout.sourceKey, label: layout.name }))]}
                          onValueChange={(nextValue) => chooseLayout(track.trackId, nextValue)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {preview.layoutsWithoutMap.length > 0 && (
              <section className={styles.matches} aria-labelledby="track-maps-title">
                <h3 id="track-maps-title" className={styles.previewTitle}>
                  {texts.mapsTitle}
                </h3>
                <p className={styles.hint}>{texts.mapsHint}</p>
                <ul className={styles.matchList}>
                  {preview.layoutsWithoutMap.map((layout) => {
                    const chosen = choices.mapMatches.find((match) => match.sourceKey === layout.sourceKey);
                    const value = chosen === undefined ? '' : chosen.mapFile === null ? NONE : chosen.mapFile;
                    return (
                      <li key={layout.sourceKey} className={styles.matchRow}>
                        <span>{layout.name}</span>
                        <Select
                          aria-label={texts.mapFor(layout.name)}
                          placeholderLabel={texts.chooseMap}
                          value={value}
                          options={[{ value: NONE, label: texts.noMap }, ...preview.unmatchedMaps.map((map) => ({ value: map.file, label: map.label }))]}
                          onValueChange={(nextValue) => chooseMap(layout.sourceKey, nextValue)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <div className={styles.actions}>
              <Button variant="secondary" disabled={isWorking} onClick={() => run({ close: true })}>
                {texts.close}
              </Button>
              {!isPreviewCurrent && (
                <Button disabled={isWorking} onClick={() => run({ apply: false, refetch: false, ...choices })}>
                  {isWorking ? texts.loading : texts.recalculate}
                </Button>
              )}
              <Button variant="confirm" disabled={isWorking || !isPreviewCurrent} onClick={() => setIsConfirmOpen(true)}>
                {isWorking ? texts.loading : texts.send}
              </Button>
            </div>
          </>
        ) : (
          <div className={styles.actions}>
            <Button disabled={isWorking} onClick={() => run({ apply: false, refetch: true, ...choices })}>
              {isWorking ? texts.loading : texts.start}
            </Button>
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={texts.confirmTitle}
        description={texts.confirmDescription}
        confirmLabel={texts.send}
        cancelLabel={texts.cancel}
        confirmVariant="confirm"
        onConfirm={() => {
          setIsConfirmOpen(false);
          run({ apply: true, refetch: false, ...choices });
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </Panel>
  );
}
