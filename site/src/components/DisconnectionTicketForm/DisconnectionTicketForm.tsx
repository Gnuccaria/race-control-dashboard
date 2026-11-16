import { normalizeTicketGapText, type TicketCrewOption, type TicketCrewProblem } from '@shared/disconnectionTicketRules';
import { sanitizeTimestampInput } from '@shared/driverSwapRules';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { FormField } from '@/components/form/FormField/FormField';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { Panel } from '@/components/ui/Panel/Panel';
import { useI18n } from '@/i18n/useI18n';
import { submitDisconnectionTicket, type TicketRequestProblem } from '../../api/disconnectionTickets';
import { endExpiredSiteSession, getFreshSiteAccessToken } from '../../auth/siteAuthStore';
import { checkTicketForm, digitsOnly, EMPTY_TICKET_VALUES, type TicketFormValues } from './disconnectionTicketValues';
import styles from './DisconnectionTicketForm.module.css';

/** Equipaggio di chi è entrato, letto dal suo ruolo Discord. */
export type TicketCrewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly crew: TicketCrewOption }
  | { readonly status: 'problem'; readonly problem: TicketCrewProblem | 'server-outdated' | 'unavailable' };

interface DisconnectionTicketFormProps {
  readonly crewState: TicketCrewState;
  /** Ticket inviato: la pagina apre il suo dettaglio. */
  readonly onSent: (ticketId: number) => void;
}

/**
 * Modulo del ticket: equipaggio (dal ruolo Discord, non modificabile), posizione (1–14), distacco da P1 (o da P2
 * se si era primi) e giro. "Invia ticket" chiede conferma ricordando che i dati sono definitivi, poi li manda.
 */
export function DisconnectionTicketForm({ crewState, onSent }: DisconnectionTicketFormProps) {
  const { messages } = useI18n();
  const texts = messages.site.disconnectionTicket.form;
  const [values, setValues] = useState<TicketFormValues>(EMPTY_TICKET_VALUES);
  const [isGapTouched, setIsGapTouched] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [failure, setFailure] = useState<TicketRequestProblem | null>(null);
  const check = checkTicketForm(values);
  const canSend = check.ticket !== null && crewState.status === 'ready' && !isSending;

  const change = (field: keyof TicketFormValues, value: string) => {
    setValues((previousValues) => ({ ...previousValues, [field]: value }));
  };

  const send = async () => {
    setIsConfirmOpen(false);
    if (!check.ticket) return;
    setIsSending(true);
    setFailure(null);
    const accessToken = await getFreshSiteAccessToken();
    const result = accessToken ? await submitDisconnectionTicket(accessToken, check.ticket) : null;
    setIsSending(false);
    if (result?.isSuccess) {
      onSent(result.value);
      return;
    }
    const problem = result ? result.problem : 'signed-out';
    if (problem === 'signed-out') endExpiredSiteSession();
    setFailure(problem);
  };

  const crewValue =
    crewState.status === 'ready' ? `#${crewState.crew.number} ${crewState.crew.name}` : crewState.status === 'loading' ? texts.crewLoading : '';

  return (
    <Panel title={texts.title} description={texts.description}>
      <form
        className={styles.ticketForm}
        noValidate
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          if (canSend) setIsConfirmOpen(true);
        }}
      >
        <p className={styles.privacyNotice} role="note">
          {texts.privacyNotice}
        </p>

        {/* Equipaggio dal ruolo Discord: si legge ma non si scrive. */}
        <FormField
          label={texts.crew}
          hint={crewState.status === 'ready' ? texts.crewHint : undefined}
          errorMessage={crewState.status === 'problem' ? texts.crewProblems[crewState.problem] : undefined}
        >
          {({ isInvalid, ...inputAttributes }) => <Input {...inputAttributes} type="text" readOnly isInvalid={isInvalid} value={crewValue} onValueChange={() => {}} />}
        </FormField>

        <div className={styles.fieldRow}>
          <FormField label={texts.position} hint={texts.positionHint} errorMessage={check.isPositionInvalid ? texts.positionInvalid : undefined}>
            {({ isInvalid, ...inputAttributes }) => (
              <Input
                {...inputAttributes}
                type="text"
                inputMode="numeric"
                maxLength={2}
                isInvalid={isInvalid}
                value={values.position}
                onValueChange={(position) => {
                  change('position', digitsOnly(position, 2));
                }}
              />
            )}
          </FormField>
          <FormField
            label={check.isLeader ? texts.gapFromSecond : texts.gapFromLeader}
            hint={texts.gapHint}
            errorMessage={isGapTouched && check.isGapInvalid ? texts.gapInvalid : undefined}
          >
            {({ isInvalid, ...inputAttributes }) => (
              <Input
                {...inputAttributes}
                type="text"
                inputMode="decimal"
                placeholder="00:00:00.000"
                spellCheck={false}
                isInvalid={isInvalid}
                value={values.gap}
                onValueChange={(gap) => {
                  change('gap', sanitizeTimestampInput(gap));
                }}
                onBlur={() => {
                  setIsGapTouched(true);
                  change('gap', normalizeTicketGapText(values.gap));
                }}
              />
            )}
          </FormField>
          <FormField label={texts.lap} hint={texts.lapHint} errorMessage={check.isLapInvalid ? texts.lapInvalid : undefined}>
            {({ isInvalid, ...inputAttributes }) => (
              <Input
                {...inputAttributes}
                type="text"
                inputMode="numeric"
                maxLength={3}
                isInvalid={isInvalid}
                value={values.disconnectedOnLap}
                onValueChange={(lap) => {
                  change('disconnectedOnLap', digitsOnly(lap, 3));
                }}
              />
            )}
          </FormField>
        </div>

        {failure && <InlineAlert>{texts.errors[failure]}</InlineAlert>}

        <Button type="submit" variant="confirm" disabled={!canSend}>
          {isSending ? texts.sending : texts.submit}
        </Button>
      </form>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={texts.confirmTitle}
        description={texts.confirmDescription}
        confirmLabel={texts.confirm}
        cancelLabel={texts.cancel}
        confirmVariant="confirm"
        onConfirm={() => void send()}
        onCancel={() => {
          setIsConfirmOpen(false);
        }}
      />
    </Panel>
  );
}
