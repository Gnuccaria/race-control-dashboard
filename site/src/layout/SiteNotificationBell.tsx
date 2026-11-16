import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BellIcon } from '@/features/disconnection-tickets/components/BellIcon/BellIcon';
import styles from '@/features/disconnection-tickets/components/NotificationBell/NotificationBell.module.css';
import { TicketSummary } from '@/features/disconnection-tickets/components/TicketSummary/TicketSummary';
import { waitingTimeFromDetails } from '@/features/fie-disconnections/model/waitingTime';
import { useI18n } from '@/i18n/useI18n';
import { disconnectionTicketPath } from '../sitePaths';
import { markResultsSeen, startSiteTicketPolling, unseenResults, useSiteTickets } from '../tickets/siteTicketStore';
import ownStyles from './SiteNotificationBell.module.css';

/**
 * Campanella del sito, accanto al profilo dopo l'accesso: avvisa quando la Direzione Gara manda il risultato
 * di un proprio ticket. Il clic sulla notifica apre subito quel ticket.
 */
export function SiteNotificationBell({ userId }: { readonly userId: string }) {
  const { messages } = useI18n();
  const texts = messages.site.notifications;
  const ticketState = useSiteTickets();
  const navigate = useNavigate();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Le notifiche nuove all'apertura restano in elenco finché la tendina è aperta.
  const [shownTicketIds, setShownTicketIds] = useState<readonly number[]>([]);
  const unseen = unseenResults(ticketState);

  useEffect(() => startSiteTicketPolling(userId), [userId]);

  const shownTickets = shownTicketIds
    .map((ticketId) => ticketState.tickets.find((ticket) => ticket.id === ticketId))
    .filter((ticket) => ticket !== undefined);

  return (
    <div className={styles.notificationBell}>
      <button type="button" className={styles.bellTrigger} popoverTarget={panelId} aria-label={texts.bellLabel(unseen.length)}>
        <BellIcon />
        {unseen.length > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unseen.length > 9 ? '9+' : unseen.length}
          </span>
        )}
      </button>

      <div
        id={panelId}
        ref={panelRef}
        popover="auto"
        className={styles.bellPanel}
        onToggle={(toggleEvent) => {
          if ((toggleEvent.nativeEvent as ToggleEvent).newState !== 'open') return;
          const ids = unseenResults(ticketState).map((ticket) => ticket.id);
          setShownTicketIds(ids);
          markResultsSeen(ids);
        }}
      >
        <p className={styles.panelTitle}>{texts.title}</p>
        {shownTickets.length === 0 ? (
          <p className={styles.empty}>{texts.empty}</p>
        ) : (
          <ul className={styles.ticketList}>
            {shownTickets.map((ticket) => {
              const waitingTime = ticket.result ? waitingTimeFromDetails(ticket.result) : null;
              const hasWait = waitingTime !== null && waitingTime.totalWaitSeconds > 0;
              return (
                <li key={ticket.id}>
                  <button
                    type="button"
                    className={styles.ticketItem}
                    data-new
                    onClick={() => {
                      panelRef.current?.hidePopover();
                      void navigate(disconnectionTicketPath(ticket.id));
                    }}
                  >
                    <TicketSummary ticket={ticket} />
                    {waitingTime && (
                      <span className={ownStyles.resultLine}>
                        {texts.resultReady(hasWait ? waitingTime.minutes : 0, hasWait ? waitingTime.seconds : 0)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
