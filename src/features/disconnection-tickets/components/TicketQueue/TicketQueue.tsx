import type { DisconnectionTicket } from '@shared/disconnectionTicketRules';
import { useI18n } from '@/i18n/useI18n';
import { TicketSummary } from '../TicketSummary/TicketSummary';
import styles from './TicketQueue.module.css';

interface TicketQueueProps {
  readonly tickets: readonly DisconnectionTicket[];
  readonly selectedTicketId: number | null;
  readonly hasLoadError: boolean;
  /** Altezza della colonna in px (quella di "Pista e stint"); con più ticket l'elenco scorre. */
  readonly height: number | null;
  readonly onSelect: (ticket: DisconnectionTicket) => void;
}

/** Elenco dei ticket da gestire sotto il tempo di attesa: card basse, il clic compila il calcolatore. */
export function TicketQueue({ tickets, selectedTicketId, hasLoadError, height, onSelect }: TicketQueueProps) {
  const { messages } = useI18n();
  const texts = messages.disconnectionTickets;
  return (
    <section
      className={styles.ticketQueue}
      aria-labelledby="ticket-queue-title"
      style={height === null ? undefined : { blockSize: `${height}px` }}
    >
      <header className={styles.queueHeader}>
        <h2 id="ticket-queue-title" className={styles.queueTitle}>
          {texts.queueTitle}
          {tickets.length > 0 && <span className={styles.queueCount}>{tickets.length}</span>}
        </h2>
        <p className={styles.queueDescription}>{texts.queueDescription}</p>
      </header>
      {hasLoadError && <p className={styles.queueNotice}>{texts.loadError}</p>}
      {tickets.length === 0 ? (
        !hasLoadError && <p className={styles.queueNotice}>{texts.empty}</p>
      ) : (
        // Con più ticket di quanti ne entrano, l'elenco scorre con la barra a lato.
        <ul className={styles.ticketCards} tabIndex={0} aria-label={texts.queueTitle}>
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                className={styles.ticketCard}
                aria-pressed={ticket.id === selectedTicketId}
                onClick={() => {
                  onSelect(ticket);
                }}
              >
                <TicketSummary ticket={ticket} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
