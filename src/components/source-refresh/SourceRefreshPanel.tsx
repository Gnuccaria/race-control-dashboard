import { type ReactNode, useId, useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Button } from '@/components/ui/Button/Button';
import { Panel } from '@/components/ui/Panel/Panel';
import { Select } from '@/components/ui/Select/Select';
import type { SourceRefresh } from '@/hooks/useSourceRefresh';
import { useI18n } from '@/i18n/useI18n';
import { serverErrorText } from '@/services/serverErrorText';
import styles from './SourceRefreshPanel.module.css';

/** Testi comuni dei pannelli di aggiornamento (messages.cars.refresh, messages.manageTracks.refresh). */
export interface SourceRefreshTexts {
  readonly title: string;
  readonly description: string;
  readonly saved: (insertedCount: number, updatedCount: number, deletedCount: number) => string;
  readonly inserted: (count: number) => string;
  readonly updated: (count: number) => string;
  readonly deleted: (count: number) => string;
  readonly kept: (names: string) => string;
  readonly showUpdated: string;
  readonly showInserted: string;
  readonly showDeleted: string;
  readonly close: string;
  readonly loading: string;
  readonly recalculate: string;
  readonly send: string;
  readonly start: string;
  readonly confirmTitle: string;
  readonly confirmDescription: string;
  readonly cancel: string;
}

/** Anteprima: le parti comuni a tutti i cataloghi. */
export interface SourceRefreshPreview<Field extends string = string> {
  readonly inserted: readonly string[];
  readonly updated: readonly {
    readonly name: string;
    readonly changes: readonly { readonly field: Field; readonly before: string | number | boolean | null; readonly after: string | number | boolean | null }[];
  }[];
  readonly deleted: readonly string[];
  readonly kept: readonly string[];
}

/** Campo cambiato in una voce aggiornata dell'anteprima. */
type ChangedField<Preview extends SourceRefreshPreview> = Preview['updated'][number]['changes'][number]['field'];

interface SourceRefreshPanelProps<Choices, Preview extends SourceRefreshPreview> {
  readonly refresh: SourceRefresh<Choices, Preview>;
  readonly texts: SourceRefreshTexts;
  /** Titolo dell'anteprima (es. con la versione del BoP). */
  readonly previewTitle: (preview: Preview) => string;
  /** Prima riga del riepilogo: quante voci in tutto. */
  readonly totalLine: (preview: Preview) => string;
  /** Nome di un campo cambiato, nell'elenco delle voci aggiornate. */
  readonly fieldLabel: (field: ChangedField<Preview>) => string;
  /** Sezioni degli abbinamenti a mano (ManualMatchSection), sotto il riepilogo. */
  readonly matchSections: (preview: Preview) => ReactNode;
}

/**
 * Pannello "Aggiorna dati" di un catalogo: esito, riepilogo dell'anteprima (nuove, aggiornate, eliminate, che
 * restano) con i dettagli, abbinamenti a mano e azioni (chiudi, ricalcola, invia con conferma).
 */
export function SourceRefreshPanel<Choices, Preview extends SourceRefreshPreview>({
  refresh,
  texts,
  previewTitle,
  totalLine,
  fieldLabel,
  matchSections,
}: SourceRefreshPanelProps<Choices, Preview>) {
  const { messages } = useI18n();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { state, preview, isWorking, isPreviewCurrent } = refresh;

  return (
    <Panel title={texts.title} description={texts.description}>
      <div className={styles.refresh}>
        {state.status === 'saved' && <InlineAlert tone="success">{texts.saved(state.preview.inserted.length, state.preview.updated.length, state.preview.deleted.length)}</InlineAlert>}
        {state.status === 'failed' && <InlineAlert>{serverErrorText(messages, state.errorKind)}</InlineAlert>}

        {preview ? (
          <>
            <p className={styles.previewTitle}>{previewTitle(preview)}</p>
            <ul className={styles.summary}>
              <li>{totalLine(preview)}</li>
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
                      {change.changes.map((fieldChange) => `${fieldLabel(fieldChange.field as ChangedField<Preview>)} ${String(fieldChange.before ?? '–')} → ${String(fieldChange.after ?? '–')}`).join(' · ')}
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

            {matchSections(preview)}

            <div className={styles.actions}>
              <Button variant="secondary" disabled={isWorking} onClick={refresh.close}>
                {texts.close}
              </Button>
              {!isPreviewCurrent && (
                <Button disabled={isWorking} onClick={refresh.recalculate}>
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
            <Button disabled={isWorking} onClick={refresh.start}>
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
          refresh.save();
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </Panel>
  );
}

/** Scelta "nessuna" nei menu degli abbinamenti (null nella scelta salvata). */
const NONE = '__none';

export interface ManualMatchItem {
  readonly key: string;
  readonly label: string;
  /** Nota tra parentesi dopo l'etichetta (es. il gruppo dell'auto, quante gare usano il tracciato). */
  readonly note?: string;
  /** Etichetta accessibile del menu ("Mappa per Monza - Completo"). */
  readonly selectLabel: string;
  /** undefined = non ancora scelto; null = "nessuna"; altrimenti il valore scelto. */
  readonly chosen: string | null | undefined;
  /** Voci del menu per questa riga. */
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

interface ManualMatchSectionProps {
  readonly title: string;
  readonly hint: string;
  readonly placeholderLabel: string;
  /** Etichetta della scelta "nessuna". */
  readonly noneLabel: string;
  readonly items: readonly ManualMatchItem[];
  /** undefined = scelta tolta; null = "nessuna". */
  readonly onChoose: (key: string, value: string | null | undefined) => void;
}

/** Sezione di abbinamenti a mano nell'anteprima: una riga per voce, con il menu delle scelte (o "nessuna"). */
export function ManualMatchSection({ title, hint, placeholderLabel, noneLabel, items, onChoose }: ManualMatchSectionProps) {
  const titleId = useId();
  if (items.length === 0) return null;
  return (
    <section className={styles.matches} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.previewTitle}>
        {title}
      </h3>
      <p className={styles.hint}>{hint}</p>
      <ul className={styles.matchList}>
        {items.map((item) => (
          <li key={item.key} className={styles.matchRow}>
            <span>
              {item.label}
              {item.note !== undefined && (
                <>
                  {' '}
                  <span className={styles.hint}>({item.note})</span>
                </>
              )}
            </span>
            <Select
              aria-label={item.selectLabel}
              placeholderLabel={placeholderLabel}
              value={item.chosen === undefined ? '' : item.chosen === null ? NONE : item.chosen}
              options={[{ value: NONE, label: noneLabel }, ...item.options]}
              onValueChange={(nextValue) => onChoose(item.key, nextValue === '' ? undefined : nextValue === NONE ? null : nextValue)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
