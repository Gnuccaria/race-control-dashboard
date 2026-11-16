import { useBlocker } from 'react-router';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { useI18n } from '@/i18n/useI18n';

interface LeaveEditingGuardProps {
  /** Attivo durante la modifica: ogni uscita dalla pagina chiede conferma. */
  readonly isActive: boolean;
}

/**
 * Intercetta la navigazione (link, indietro, header) mentre si modifica e chiede conferma
 * con lo stesso popup dell'uscita dall'account. Confermando si esce e le modifiche si perdono.
 */
export function LeaveEditingGuard({ isActive }: LeaveEditingGuardProps) {
  const { messages } = useI18n();
  const editingTexts = messages.editing;
  const navigationBlocker = useBlocker(
    ({ currentLocation, nextLocation }) => isActive && currentLocation.pathname !== nextLocation.pathname,
  );

  return (
    <ConfirmDialog
      isOpen={navigationBlocker.state === 'blocked'}
      title={editingTexts.leaveTitle}
      description={editingTexts.leaveDescription}
      confirmLabel={editingTexts.leaveConfirm}
      cancelLabel={editingTexts.leaveCancel}
      onConfirm={() => {
        navigationBlocker.proceed?.();
      }}
      onCancel={() => {
        navigationBlocker.reset?.();
      }}
    />
  );
}
