import { useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { Button } from '@/components/ui/Button/Button';
import { useI18n } from '@/i18n/useI18n';
import styles from './SelectionDeleteBar.module.css';

/** Nel popup si elencano al massimo questi nomi; gli altri diventano "e altri N". */
const MAX_NAMED_ROWS = 5;

export interface SelectedRow {
  readonly id: number;
  /** Come la riga viene nominata nel popup di conferma. */
  readonly label: string;
}

export interface SelectionDeleteTexts {
  readonly selectedCount: (selectedCount: number) => string;
  readonly deleteLabel: string;
  readonly deletingLabel: string;
  readonly confirmTitle: (selectedCount: number) => string;
  readonly confirmDescription: (rowList: string) => string;
  readonly otherRows: (otherCount: number) => string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
}

interface SelectionDeleteBarProps {
  readonly selectedRows: readonly SelectedRow[];
  readonly texts: SelectionDeleteTexts;
  readonly isDeleting: boolean;
  readonly onDelete: (ids: readonly number[]) => void;
}

/** Sotto la tabella quando c'è almeno una selezione: conteggio e "Elimina", con conferma. */
export function SelectionDeleteBar({ selectedRows, texts, isDeleting, onDelete }: SelectionDeleteBarProps) {
  const { locale } = useI18n();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // "A, B e C" nella forma corretta per ogni lingua.
  const namedRows = selectedRows.slice(0, MAX_NAMED_ROWS).map((row) => row.label);
  const otherCount = selectedRows.length - namedRows.length;
  const rowList = new Intl.ListFormat(locale, { type: 'conjunction' }).format(
    otherCount > 0 ? [...namedRows, texts.otherRows(otherCount)] : namedRows,
  );

  return (
    <div className={styles.selectionDeleteBar}>
      <p className={styles.selectedCount}>{texts.selectedCount(selectedRows.length)}</p>
      <Button
        variant="danger"
        disabled={isDeleting}
        onClick={() => {
          setIsConfirmOpen(true);
        }}
      >
        {isDeleting ? texts.deletingLabel : texts.deleteLabel}
      </Button>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={texts.confirmTitle(selectedRows.length)}
        description={texts.confirmDescription(rowList)}
        confirmLabel={texts.confirmLabel}
        cancelLabel={texts.cancelLabel}
        onConfirm={() => {
          setIsConfirmOpen(false);
          onDelete(selectedRows.map((row) => row.id));
        }}
        onCancel={() => {
          setIsConfirmOpen(false);
        }}
      />
    </div>
  );
}
