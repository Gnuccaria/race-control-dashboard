import { useEffect, useId, useRef } from 'react';
import { useNavigate } from 'react-router';
import { BellIcon } from '@/features/disconnection-tickets/components/BellIcon/BellIcon';
import styles from '@/features/disconnection-tickets/components/NotificationBell/NotificationBell.module.css';
import { TicketSummary } from '@/features/disconnection-tickets/components/TicketSummary/TicketSummary';
import { waitingTimeFromDetails } from '@/features/fie-disconnections/model/waitingTime';
import { ProtestSummary } from '@/features/protests/ProtestSummary';
import { useI18n } from '@/i18n/useI18n';
import { setUnreadNotificationCount } from '@/lib/unreadNotificationCount';
import { markRejectionsSeen, startSiteProtestPolling, unseenRejections, useSiteProtests } from '../protests/siteProtestStore';
import { disconnectionTicketPath, protestPath } from '../sitePaths';
import { markResultsSeen, startSiteTicketPolling, unseenResults, useSiteTickets } from '../tickets/siteTicketStore';
import ownStyles from './SiteNotificationBell.module.css';

/**
 * Campanella del sito, accanto al profilo dopo l'accesso: avvisa quando la Direzione Gara manda il risultato
 * di un ticket e quando i Commissari Sportivi respingono una protesta (propria o del proprio equipaggio).
 * La tendina elenca tutte le notifiche non lette; il clic su una la segna come letta (solo quella) e apre il
 * ticket o la protesta. Il numero delle non lette compare anche nel titolo della scheda: "(2) …".
 */
export function SiteNotificationBell({ userId }: { readonly userId: string }) {
  const { messages } = useI18n();
  const texts = messages.site.notifications;
  const ticketState = useSiteTickets();
  const protestState = useSiteProtests();
  const navigate = useNavigate();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const shownTickets = unseenResults(ticketState);
  const shownProtests = unseenRejections(protestState);
  const unreadCount = shownTickets.length + shownProtests.length;

  useEffect(() => startSiteTicketPolling(userId), [userId]);
  useEffect(() => startSiteProtestPolling(userId), [userId]);
  useEffect(() => setUnreadNotificationCount(unreadCount), [unreadCount]);
  useEffect(() => () => setUnreadNotificationCount(0), []);

  /** Clic su una notifica: diventa letta solo quella, poi si apre. */
  const openItem = (markRead: () => void, path: string) => {
    markRead();
    panelRef.current?.hidePopover();
    void navigate(path);
  };

  return (
    <div className={styles.notificationBell}>
      <button type="button" className={styles.bellTrigger} popoverTarget={panelId} aria-label={texts.bellLabel(unreadCount)}>
        <BellIcon />
        {unreadCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <div
        id={panelId}
        ref={panelRef}
        popover="auto"
        className={styles.bellPanel}
      >
        <p className={styles.panelTitle}>{texts.title}</p>
        {shownTickets.length === 0 && shownProtests.length === 0 ? (
          <p className={styles.empty}>{texts.empty}</p>
        ) : (
          <ul className={styles.ticketList}>
            {shownProtests.map((protest) => (
              <li key={`protest-${protest.id}`}>
                <button type="button" className={styles.ticketItem} data-new onClick={() => openItem(() => markRejectionsSeen([protest.id]), protestPath(protest.id))}>
                  <ProtestSummary protest={protest} />
                  <span className={ownStyles.resultLine}>{protest.status === 'accepted' ? texts.protestAccepted : texts.protestRejected}</span>
                </button>
              </li>
            ))}
            {shownTickets.map((ticket) => {
              const waitingTime = ticket.result ? waitingTimeFromDetails(ticket.result) : null;
              const hasWait = waitingTime !== null && waitingTime.totalWaitSeconds > 0;
              return (
                <li key={`ticket-${ticket.id}`}>
                  <button type="button" className={styles.ticketItem} data-new onClick={() => openItem(() => markResultsSeen([ticket.id]), disconnectionTicketPath(ticket.id))}>
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
