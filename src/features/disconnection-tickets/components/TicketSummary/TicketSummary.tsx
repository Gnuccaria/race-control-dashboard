import { type DisconnectionTicket, isLeaderPosition } from '@shared/disconnectionTicketRules';
import { formatRaceTimestamp } from '@shared/driverSwapRules';
import { useI18n } from '@/i18n/useI18n';
import styles from './TicketSummary.module.css';

interface TicketSummaryProps {
  readonly ticket: DisconnectionTicket;
  readonly isNew?: boolean;
}

/** Contenuto compatto di un ticket: numero, equipaggio, posizione, giro e distacco. */
export function TicketSummary({ ticket, isNew = false }: TicketSummaryProps) {
  const { messages } = useI18n();
  const texts = messages.disconnectionTickets;
  const gapLabel = isLeaderPosition(ticket.position) ? texts.gapFromSecond : texts.gapFromLeader;
  return (
    <span className={styles.ticketSummary}>
      <span className={styles.titleRow}>
        <span className={styles.title}>{texts.ticketTitle(ticket.id)}</span>
        {isNew && <span className={styles.newLabel}>{texts.newLabel}</span>}
      </span>
      <span className={styles.crew}>
        #{ticket.crewNumber} {ticket.crewName}
      </span>
      <span className={styles.details}>
        {texts.ticketDetails(ticket.position, ticket.disconnectedOnLap)} · {gapLabel} {formatRaceTimestamp(ticket.gapMs)}
      </span>
    </span>
  );
}
