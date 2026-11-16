import { Button } from '@/components/ui/Button/Button';
import { useI18n } from '@/i18n/useI18n';

interface SubmitCrewButtonProps {
  /** Attivo solo quando tutti i campi sono compilati correttamente. */
  readonly isDraftComplete: boolean;
  readonly isSubmitting: boolean;
}

/** Pulsante di invio: disattivato finché i dati non sono validi o mentre il server risponde. */
export function SubmitCrewButton({ isDraftComplete, isSubmitting }: SubmitCrewButtonProps) {
  const { messages } = useI18n();

  return (
    <Button type="submit" variant="confirm" disabled={!isDraftComplete || isSubmitting}>
      {isSubmitting ? messages.crews.creatingCrew : messages.crews.createCrew}
    </Button>
  );
}
