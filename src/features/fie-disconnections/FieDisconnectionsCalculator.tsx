import type { DisconnectionTicket, TicketResultDetails, TicketDiscordMessage } from '@shared/disconnectionTicketRules';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { ToolLayout } from '@/components/layout/ToolLayout/ToolLayout';
import { Button } from '@/components/ui/Button/Button';
import { UsageGuide } from '@/components/ui/UsageGuide/UsageGuide';
import { TicketAvailabilitySwitch } from '@/features/disconnection-tickets/components/TicketAvailabilitySwitch/TicketAvailabilitySwitch';
import { TicketQueue } from '@/features/disconnection-tickets/components/TicketQueue/TicketQueue';
import { submitTicketResult } from '@/features/disconnection-tickets/services/ticketApi';
import { ticketStore, useTicketState } from '@/features/disconnection-tickets/ticketStore';
import { useElementHeight } from '@/hooks/useElementHeight';
import { useI18n } from '@/i18n/useI18n';
import type { ServerErrorKind } from '@/services/serverApi';
import { DisconnectionTicketPanel } from './components/DisconnectionTicketPanel/DisconnectionTicketPanel';
import { TrackSettingsPanel } from './components/TrackSettingsPanel/TrackSettingsPanel';
import { WaitingTimeBoard } from './components/WaitingTimeBoard/WaitingTimeBoard';
import { useDisconnectionCalculator } from './hooks/useDisconnectionCalculator';
import styles from './FieDisconnectionsCalculator.module.css';
import { serverErrorText } from '@/services/serverErrorText';

type ResultFeedback =
  | { readonly kind: 'sent'; readonly ticketId: number; readonly discordMessage: TicketDiscordMessage | null }
  | { readonly kind: 'already-resolved' }
  | { readonly kind: 'error'; readonly errorKind: ServerErrorKind };

/**
 * Strumento "Disconnessioni FIE": calcolatore e, sotto il tempo di attesa, i ticket da gestire mandati dal sito
 * (colonna alta quanto "Pista e stint", con scorrimento). Il clic su un ticket compila il calcolatore;
 * "Invia risultato" chiude il ticket mandando anche il dettaglio del calcolo (nascosto qui, mostrato sul sito),
 * svuota i dati del ticket e lo toglie dall'elenco.
 */
export function FieDisconnectionsCalculator() {
  const {
    position,
    selectPosition,
    fillFromTicket,
    clearTicketFields,
    bindField,
    trackCatalog,
    trackChoice,
    trackLengthStatus,
    selectTrack,
    waitingTime,
    gapSeconds,
    pitStallEntrySeconds,
    driveThroughSeconds,
    stintTotalLaps,
    trackLengthKm,
  } = useDisconnectionCalculator();
  const { messages } = useI18n();
  const ticketTexts = messages.disconnectionTickets;
  const ticketState = useTicketState();
  const [searchParams] = useSearchParams();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<ResultFeedback | null>(null);
  const { attachElement: attachTrackPanel, height: trackPanelHeight } = useElementHeight<HTMLDivElement>();

  useEffect(() => ticketStore.startPolling(), []);

  const selectTicket = (ticket: DisconnectionTicket) => {
    setSelectedTicketId(ticket.id);
    setFeedback(null);
    fillFromTicket(ticket);
  };

  // Arrivando dalla campanella (?ticket=12) il ticket si sceglie da solo appena i ticket sono letti,
  // una volta sola per ogni ticket richiesto (aggiornamento durante il render, senza effetti).
  const requestedTicket = ticketState.tickets.find((ticket) => ticket.id === Number(searchParams.get('ticket')));
  const [handledRequestId, setHandledRequestId] = useState<number | null>(null);
  if (requestedTicket && handledRequestId !== requestedTicket.id) {
    setHandledRequestId(requestedTicket.id);
    selectTicket(requestedTicket);
  }

  const selectedTicket = ticketState.tickets.find((ticket) => ticket.id === selectedTicketId) ?? null;
  const canSendResult = selectedTicket !== null && waitingTime !== null && !isSending;

  const sendResult = async () => {
    if (!selectedTicket || !waitingTime || trackLengthKm === null) return;
    setIsSending(true);
    // "Dettaglio del calcolo": non si mostra qui, ma va al server con il risultato e il sito lo mostra al team.
    const details: TicketResultDetails = {
      position,
      missingLaps: waitingTime.missingLaps,
      penaltySeconds: waitingTime.penaltySeconds,
      gapSeconds,
      pitStallEntrySeconds,
      totalWaitSeconds: waitingTime.totalWaitSeconds,
      trackLengthKm,
      driveThroughSeconds,
      stintTotalLaps,
    };
    const result = await submitTicketResult(selectedTicket.id, details);
    setIsSending(false);
    if (!result.isSuccess && result.errorKind !== 'ticket-already-resolved') {
      setFeedback({ kind: 'error', errorKind: result.errorKind });
      return;
    }
    ticketStore.removeTicket(selectedTicket.id);
    setSelectedTicketId(null);
    clearTicketFields();
    setFeedback(result.isSuccess ? { kind: 'sent', ticketId: selectedTicket.id, discordMessage: result.value } : { kind: 'already-resolved' });
  };

  return (
    <ToolLayout
      toolInfo={messages.tools.fieDisconnections}
      inputsLabel={messages.fieDisconnections.inputsLabel}
      inputs={
        <>
          <DisconnectionTicketPanel
            position={position}
            onPositionSelect={selectPosition}
            disconnectedOnLapField={bindField('disconnectedOnLap')}
            gapField={bindField('gapSeconds')}
          />
          <div ref={attachTrackPanel} className={styles.trackPanel}>
            <TrackSettingsPanel
            driveThroughField={bindField('driveThroughSeconds')}
            stintTotalLapsField={bindField('stintTotalLaps')}
            pitStallEntryField={bindField('pitStallEntrySeconds')}
            trackChoice={trackChoice}
            trackCatalog={trackCatalog}
            trackLengthStatus={trackLengthStatus}
            onTrackChange={selectTrack}
            />
          </div>
        </>
      }
      results={
        <>
          <WaitingTimeBoard waitingTime={waitingTime} />
          <TicketAvailabilitySwitch />
          <TicketQueue
            tickets={ticketState.tickets}
            selectedTicketId={selectedTicketId}
            hasLoadError={ticketState.status === 'error'}
            height={trackPanelHeight}
            onSelect={selectTicket}
          />
          <div className={styles.resultActions}>
            {feedback?.kind === 'sent' && (
              <InlineAlert tone="success">
                {feedback.discordMessage === 'sent'
                  ? `${ticketTexts.resultSent(feedback.ticketId)} ${ticketTexts.postedOnDiscord}`
                  : ticketTexts.resultSent(feedback.ticketId)}
              </InlineAlert>
            )}
            {feedback?.kind === 'sent' && (feedback.discordMessage === 'no-channel' || feedback.discordMessage === 'failed') && (
              <InlineAlert>{ticketTexts.discordProblems[feedback.discordMessage]}</InlineAlert>
            )}
            {feedback?.kind === 'already-resolved' && <InlineAlert>{ticketTexts.alreadyResolved}</InlineAlert>}
            {feedback?.kind === 'error' && <InlineAlert>{serverErrorText(messages, feedback.errorKind)}</InlineAlert>}
            <p className={styles.resultHint}>
              {selectedTicket ? ticketTexts.selectedTicket(selectedTicket.id) : ticketTexts.sendResultHint}
            </p>
            <Button variant="confirm" disabled={!canSendResult} onClick={() => void sendResult()}>
              {isSending ? ticketTexts.sendingResult : ticketTexts.sendResult}
            </Button>
          </div>
        </>
      }
      isResultsSticky={false}
      guide={<UsageGuide steps={messages.fieDisconnections.usageSteps} />}
    />
  );
}
