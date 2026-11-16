import { useEffect } from 'react';
import { Link } from 'react-router';
import { StatusBadge } from '@/components/ui/StatusBadge/StatusBadge';
import { TicketSummary } from '@/features/disconnection-tickets/components/TicketSummary/TicketSummary';
import { useI18n } from '@/i18n/useI18n';
import { disconnectionTicketPath } from '../../sitePaths';
import { startSiteTicketPolling, useSiteTickets } from '../../tickets/siteTicketStore';
import styles from './MyTicketList.module.css';

/** I ticket di chi è entrato e del suo equipaggio (stesso ruolo), dal più recente: chi l'ha inviato, stato e link al dettaglio. */
export function MyTicketList({ userId }: { readonly userId: string }) {
  const { messages } = useI18n();
  const texts = messages.site.myTickets;
  const { tickets } = useSiteTickets();

  useEffect(() => startSiteTicketPolling(userId), [userId]);

  return (
    <section className={styles.myTickets} aria-labelledby="my-tickets-title">
      <h2 id="my-tickets-title" className={styles.title}>
        {texts.title}
      </h2>
      {tickets.length === 0 ? (
        <p className={styles.empty}>{texts.empty}</p>
      ) : (
        <ul className={styles.ticketList}>
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link to={disconnectionTicketPath(ticket.id)} className={styles.ticketLink}>
                <span className={styles.ticketText}>
                  <TicketSummary ticket={ticket} />
                  <span className={styles.sentBy}>
                    {texts.sentBy} {ticket.submittedByName}
                  </span>
                </span>
                <StatusBadge tone={ticket.status === 'resolved' ? 'positive' : 'warning'} label={ticket.status === 'resolved' ? texts.resolved : texts.open} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
