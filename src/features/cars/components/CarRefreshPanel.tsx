import type { CarRefreshPreview, CarSourceMatch } from '@shared/carRules';
import { startTransition, useActionState, useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Button } from '@/components/ui/Button/Button';
import { Panel } from '@/components/ui/Panel/Panel';
import { Select } from '@/components/ui/Select/Select';
import { useI18n } from '@/i18n/useI18n';
import type { ServerErrorKind } from '@/services/serverApi';
import { refreshCars } from '../carApi';
import styles from '../ManageCarsPage.module.css';
import { serverErrorText } from '@/services/serverErrorText';

/** Scelta "nessuna auto di gt-engine" nel menu degli abbinamenti. */
const NO_BOP = '__none';

type RefreshState =
  | { readonly status: 'idle' }
  | { readonly status: 'preview'; readonly preview: CarRefreshPreview; readonly sentMatches: readonly CarSourceMatch[] }
  | { readonly status: 'saved'; readonly preview: CarRefreshPreview }
  | { readonly status: 'failed'; readonly errorKind: ServerErrorKind; readonly preview: CarRefreshPreview | null };

/** refetch: true solo per "Aggiorna dati" (riscarica i siti); ricalcolo e invio riusano i dati dell'anteprima. */
type RefreshAction = { readonly apply: boolean; readonly refetch: boolean; readonly matches: readonly CarSourceMatch[] } | { readonly close: true };

interface CarRefreshPanelProps {
  /** Dopo il salvataggio: la pagina rilegge le vetture. */
  readonly onSaved: () => void;
}

const sameMatches = (first: readonly CarSourceMatch[], second: readonly CarSourceMatch[]) =>
  first.length === second.length && first.every((match) => second.some((other) => other.officialId === match.officialId && other.bopKey === match.bopKey));

/**
 * Aggiornamento manuale delle vetture: "Aggiorna dati" chiede al server di scaricare il catalogo ufficiale di GT7 e il
 * BoP Midspeed di gt-engine.com e mostra l'anteprima (nuove, aggiornate, eliminate, che restano). Le auto senza BoP
 * trovato si abbinano a mano (o "nessuna") e l'anteprima si ricalcola; "Invia al server" salva, dopo una conferma.
 */
export function CarRefreshPanel({ onSaved }: CarRefreshPanelProps) {
  const { messages } = useI18n();
  const texts = messages.cars.refresh;
  const [matches, setMatches] = useState<readonly CarSourceMatch[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [state, dispatch, isWorking] = useActionState<RefreshState, RefreshAction>(async (previousState, action) => {
    if ('close' in action) return { status: 'idle' };
    const currentPreview = 'preview' in previousState ? previousState.preview : null;
    const result = await refreshCars(action.matches, action.apply, action.refetch);
    if (!result.isSuccess) return { status: 'failed', errorKind: result.errorKind, preview: currentPreview };
    if (action.apply) {
      onSaved();
      return { status: 'saved', preview: result.value.preview };
    }
    return { status: 'preview', preview: result.value.preview, sentMatches: action.matches };
  }, { status: 'idle' });

  const run = (action: RefreshAction) => {
    startTransition(() => {
      dispatch(action);
    });
  };
  const preview = state.status === 'preview' || state.status === 'failed' ? state.preview : null;
  const isPreviewCurrent = state.status === 'preview' && sameMatches(state.sentMatches, matches);
  const chooseMatch = (officialId: string, value: string) => {
    setMatches((previous) => {
      const others = previous.filter((match) => match.officialId !== officialId);
      return value === '' ? others : [...others, { officialId, bopKey: value === NO_BOP ? null : value }];
    });
  };

  return (
    <Panel title={texts.title} description={texts.description}>
      <div className={styles.refresh}>
        {state.status === 'saved' && <InlineAlert tone="success">{texts.saved(state.preview.inserted.length, state.preview.updated.length, state.preview.deleted.length)}</InlineAlert>}
        {state.status === 'failed' && <InlineAlert>{serverErrorText(messages, state.errorKind)}</InlineAlert>}

        {preview ? (
          <>
            <p className={styles.previewTitle}>{preview.bopVersion ? texts.previewTitleWithVersion(preview.bopVersion) : texts.previewTitle}</p>
            <ul className={styles.summary}>
              <li>{texts.carCount(preview.cars.length)}</li>
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
                      <strong>{change.name}</strong>:{' '}
                      {change.changes.map((fieldChange) => `${messages.cars.manage.columns[fieldChange.field]} ${fieldChange.before ?? '–'} → ${fieldChange.after ?? '–'}`).join(' · ')}
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

            {preview.unmatchedOfficial.length > 0 && (
              <section className={styles.matches} aria-labelledby="car-matches-title">
                <h3 id="car-matches-title" className={styles.previewTitle}>
                  {texts.unmatchedTitle}
                </h3>
                <p className={styles.hint}>{texts.unmatchedHint}</p>
                <ul className={styles.matchList}>
                  {preview.unmatchedOfficial.map((car) => {
                    const chosen = matches.find((match) => match.officialId === car.officialId);
                    const value = chosen === undefined ? '' : chosen.bopKey === null ? NO_BOP : chosen.bopKey;
                    const options = preview.unmatchedBop.filter((candidate) => candidate.group === car.group);
                    return (
                      <li key={car.officialId} className={styles.matchRow}>
                        <span>
                          {car.name} <span className={styles.hint}>({car.group})</span>
                        </span>
                        <Select
                          aria-label={texts.matchFor(car.name)}
                          placeholderLabel={texts.chooseBopCar}
                          value={value}
                          options={[{ value: NO_BOP, label: texts.noBopCar }, ...options.map((option) => ({ value: option.key, label: option.name }))]}
                          onValueChange={(nextValue) => chooseMatch(car.officialId, nextValue)}
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
                <Button disabled={isWorking} onClick={() => run({ apply: false, refetch: false, matches })}>
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
            <Button disabled={isWorking} onClick={() => run({ apply: false, refetch: true, matches })}>
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
          run({ apply: true, refetch: false, matches });
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </Panel>
  );
}
