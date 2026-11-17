import { useEffect, useState } from 'react';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Switch } from '@/components/ui/Switch/Switch';
import { useI18n } from '@/i18n/useI18n';
import type { ServerErrorKind } from '@/services/serverApi';
import { fetchTicketAvailability, saveTicketAvailability } from '../../services/ticketApi';

type AvailabilityState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly isOpen: boolean; readonly isSaving: boolean; readonly errorKind: ServerErrorKind | null };

/**
 * Interruttore "Ticket dal sito" del Calcolatore disconnessioni: acceso, i piloti possono aprire la card dei ticket
 * di disconnessione sul sito e inviarli; spento, la card è disattivata e il server rifiuta gli invii.
 * Si salva subito sul server; se il salvataggio non riesce torna com'era e lo dice.
 */
export function TicketAvailabilitySwitch() {
  const { messages } = useI18n();
  const texts = messages.disconnectionTickets.availability;
  const [state, setState] = useState<AvailabilityState>({ status: 'loading' });

  useEffect(() => {
    let isCurrent = true;
    void fetchTicketAvailability().then((result) => {
      if (!isCurrent) return;
      setState(
        result.isSuccess
          ? { status: 'ready', isOpen: result.value.isOpen, isSaving: false, errorKind: null }
          : { status: 'ready', isOpen: true, isSaving: false, errorKind: result.errorKind },
      );
    });
    return () => {
      isCurrent = false;
    };
  }, []);

  const change = async (isOpen: boolean) => {
    if (state.status !== 'ready' || state.isSaving) return;
    const previousIsOpen = state.isOpen;
    setState({ status: 'ready', isOpen, isSaving: true, errorKind: null });
    const result = await saveTicketAvailability({ isOpen });
    setState(
      result.isSuccess
        ? { status: 'ready', isOpen: result.value.isOpen, isSaving: false, errorKind: null }
        : { status: 'ready', isOpen: previousIsOpen, isSaving: false, errorKind: result.errorKind },
    );
  };

  if (state.status === 'loading') return <p role="status">{texts.loading}</p>;
  return (
    <div>
      <Switch
        label={texts.label}
        description={state.isOpen ? texts.openDescription : texts.closedDescription}
        isChecked={state.isOpen}
        onCheckedChange={(isOpen) => void change(isOpen)}
      />
      {state.errorKind && <InlineAlert>{messages.serverErrors[state.errorKind]}</InlineAlert>}
    </div>
  );
}
