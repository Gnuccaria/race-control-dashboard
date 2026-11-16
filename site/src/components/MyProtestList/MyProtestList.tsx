import type { SiteProtest } from '@shared/protestRules';
import { Link } from 'react-router';
import { StatusBadge } from '@/components/ui/StatusBadge/StatusBadge';
import { useI18n } from '@/i18n/useI18n';
import { protestPath } from '../../sitePaths';
import styles from '../MyTicketList/MyTicketList.module.css';

/** Proteste di chi è entrato e del suo equipaggio, dalla più recente: chi l'ha inviata, esito e link al dettaglio. */
export function MyProtestList({ protests }: { readonly protests: readonly SiteProtest[] | null }) {
  const { messages } = useI18n();
  const texts = messages.site.myProtests;

  return (
    <section className={styles.myTickets} aria-labelledby="my-protests-title">
      <h2 id="my-protests-title" className={styles.title}>
        {texts.title}
      </h2>
      {protests === null ? (
        <p className={styles.empty} role="status">
          {messages.site.loading}
        </p>
      ) : protests.length === 0 ? (
        <p className={styles.empty}>{texts.empty}</p>
      ) : (
        <ul className={styles.ticketList}>
          {protests.map((protest) => (
            <li key={protest.id}>
              <Link to={protestPath(protest.id)} className={styles.ticketLink}>
                <span className={styles.ticketText}>
                  <strong>{texts.protestTitle(protest.id)}</strong>
                  <span>{texts.summary(protest.stint, protest.lap, protest.corner)}</span>
                  <span className={styles.sentBy}>
                    {messages.site.myTickets.sentBy} {protest.submittedByName}
                  </span>
                </span>
                <StatusBadge tone={protest.status === 'rejected' ? 'critical' : 'warning'} label={texts.statuses[protest.status]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
