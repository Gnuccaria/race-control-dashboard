import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { BellIcon } from '@/features/disconnection-tickets/components/BellIcon/BellIcon';
import styles from '@/features/disconnection-tickets/components/NotificationBell/NotificationBell.module.css';
import { TicketSummary } from '@/features/disconnection-tickets/components/TicketSummary/TicketSummary';
import { waitingTimeFromDetails } from '@/features/fie-disconnections/model/waitingTime';
import { ProtestSummary } from '@/features/protests/ProtestSummary';
import { useI18n } from '@/i18n/useI18n';
import { markRejectionsSeen, startSiteProtestPolling, unseenRejections, useSiteProtests } from '../protests/siteProtestStore';
import { disconnectionTicketPath, protestPath } from '../sitePaths';
import { markResultsSeen, startSiteTicketPolling, unseenResults, useSiteTickets } from '../tickets/siteTicketStore';
import ownStyles from './SiteNotificationBell.module.css';

/**
 * Campanella del sito, accanto al profilo dopo l'accesso: avvisa quando la Direzione Gara manda il risultato
 * di un ticket e quando i Commissari Sportivi respingono una protesta (propria o del proprio equipaggio).
 * Il clic sulla notifica apre subito il ticket o la protesta.
 */
export function SiteNotificationBell({ userId }: { readonly userId: string }) {
  const { messages } = useI18n();
  const texts = messages.site.notifications;
  const ticketState = useSiteTickets();
  const protestState = useSiteProtests();
  const navigate = useNavigate();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Le notifiche nuove all'apertura restano in elenco finché la tendina è aperta.
  const [shownTicketIds, setShownTicketIds] = useState<readonly number[]>([]);
  const [shownProtestIds, setShownProtestIds] = useState<readonly number[]>([]);
  const unseenCount = unseenResults(ticketState).length + unseenRejections(protestState).length;

  useEffect(() => startSiteTicketPolling(userId), [userId]);
  useEffect(() => startSiteProtestPolling(userId), [userId]);

  const shownTickets = shownTicketIds.map((ticketId) => ticketState.items.find((ticket) => ticket.id === ticketId)).filter((ticket) => ticket !== undefined);
  const shownProtests = shownProtestIds
    .map((protestId) => protestState.items.find((protest) => protest.id === protestId))
    .filter((protest) => protest !== undefined);

  const openItem = (path: string) => {
    panelRef.current?.hidePopover();
    void navigate(path);
  };

  return (
    <div className={styles.notificationBell}>
      <button type="button" className={styles.bellTrigger} popoverTarget={panelId} aria-label={texts.bellLabel(unseenCount)}>
        <BellIcon />
        {unseenCount > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unseenCount > 9 ? '9+' : unseenCount}
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
          const ticketIds = unseenResults(ticketState).map((ticket) => ticket.id);
          const protestIds = unseenRejections(protestState).map((protest) => protest.id);
          setShownTicketIds(ticketIds);
          setShownProtestIds(protestIds);
          markResultsSeen(ticketIds);
          markRejectionsSeen(protestIds);
        }}
      >
        <p className={styles.panelTitle}>{texts.title}</p>
        {shownTickets.length === 0 && shownProtests.length === 0 ? (
          <p className={styles.empty}>{texts.empty}</p>
        ) : (
          <ul className={styles.ticketList}>
            {shownProtests.map((protest) => (
              <li key={`protest-${protest.id}`}>
                <button type="button" className={styles.ticketItem} data-new onClick={() => openItem(protestPath(protest.id))}>
                  <ProtestSummary protest={protest} />
                  <span className={ownStyles.resultLine}>{texts.protestRejected}</span>
                </button>
              </li>
            ))}
            {shownTickets.map((ticket) => {
              const waitingTime = ticket.result ? waitingTimeFromDetails(ticket.result) : null;
              const hasWait = waitingTime !== null && waitingTime.totalWaitSeconds > 0;
              return (
                <li key={`ticket-${ticket.id}`}>
                  <button type="button" className={styles.ticketItem} data-new onClick={() => openItem(disconnectionTicketPath(ticket.id))}>
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
