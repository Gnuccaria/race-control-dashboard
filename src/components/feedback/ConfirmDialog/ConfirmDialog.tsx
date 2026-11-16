import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/Button/Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  /** Chiamata anche con Esc. */
  readonly onCancel: () => void;
  /** Colore del pulsante di conferma: rosso (default) per eliminare o uscire, verde per inviare o salvare. */
  readonly confirmVariant?: 'danger' | 'confirm';
}

/**
 * Finestra di conferma modale basata su <dialog> nativo: blocca il resto della pagina,
 * intrappola il focus, si chiude con Esc e riporta il focus dove si trovava.
 * Il focus iniziale va su "annulla": l'azione distruttiva richiede una scelta esplicita.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = 'danger',
}: ConfirmDialogProps) {
  const dialogElementRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Sincronizza lo stato React con l'API imperativa del browser (showModal/close).
  useEffect(() => {
    const dialogElement = dialogElementRef.current;
    if (!dialogElement) return;
    if (isOpen && !dialogElement.open) dialogElement.showModal();
    if (!isOpen && dialogElement.open) dialogElement.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogElementRef}
      className={styles.confirmDialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(cancelEvent) => {
        cancelEvent.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId} className={styles.dialogTitle}>
        {title}
      </h2>
      <p id={descriptionId} className={styles.dialogDescription}>
        {description}
      </p>
      <div className={styles.dialogActions}>
        <Button variant="secondary" autoFocus onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
