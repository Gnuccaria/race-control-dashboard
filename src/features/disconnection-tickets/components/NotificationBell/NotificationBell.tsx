import { useEffect, useId, useRef } from 'react';
import { useNavigate } from 'react-router';
import type { AppAccess } from '@/features/auth/model/discordProfile';
import { ProtestSummary } from '@/features/protests/ProtestSummary';
import { protestHref, protestStore, unreadProtests, useProtestState } from '@/features/protests/protestStore';
import { useI18n } from '@/i18n/useI18n';
import { setUnreadNotificationCount } from '@/lib/unreadNotificationCount';
import { disconnectionTicketHref } from '../../ticketPaths';
import { startTaskbarBadge } from '../../taskbarBadge';
import { ticketStore, unreadTickets, useTicketState } from '../../ticketStore';
import { BellIcon } from '../BellIcon/BellIcon';
import { TicketSummary } from '../TicketSummary/TicketSummary';
import styles from './NotificationBell.module.css';

/**
 * Campanella accanto al profilo, con una sezione per ruolo:
 * - Direzione Gara: i ticket di disconnessione da gestire; il clic apre il calcolatore con il ticket già compilato;
 * - Commissari Sportivi: le proteste in esame; il clic apre la protesta in "Gestisci proteste".
 * Ogni ticket e ogni protesta è una notifica non letta (segnata "Nuovo"/"Nuova") finché non la si clicca: il clic
 * segna come letta solo quella. Il numero delle non lette compare sulla campanella, nel titolo della finestra e
 * sull'icona dell'app nella barra delle applicazioni.
 */
export function NotificationBell({ access }: { readonly access: Pick<AppAccess, 'raceControl' | 'stewards'> }) {
  const { messages } = useI18n();
  const texts = messages.disconnectionTickets;
  const protestTexts = messages.protests.notifications;
  const ticketState = useTicketState();
  const protestState = useProtestState();
  const navigate = useNavigate();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const { raceControl: showsTickets, stewards: showsProtests } = access;
  const unreadCount = (showsTickets ? unreadTickets(ticketState).length : 0) + (showsProtests ? unreadProtests(protestState).length : 0);

  useEffect(() => (showsTickets ? ticketStore.startPolling() : undefined), [showsTickets]);
  useEffect(() => (showsProtests ? protestStore.startPolling() : undefined), [showsProtests]);
  // Stesso numero anche sull'icona dell'app nella barra delle applicazioni.
  useEffect(() => startTaskbarBadge({ raceControl: showsTickets, stewards: showsProtests }), [showsTickets, showsProtests]);
  // Stesso numero nel titolo della finestra: "(3) Race Control Dashboard".
  useEffect(() => setUnreadNotificationCount(unreadCount), [unreadCount]);
  useEffect(() => () => setUnreadNotificationCount(0), []);

  const tickets = [...ticketState.tickets].reverse();
  // Tutte le proteste in esame (la tendina scorre): ogni notifica non letta deve potersi cliccare.
  const protests = protestState.tickets.filter((protest) => protest.status === 'open');

  /** Clic su una notifica: diventa letta solo quella, poi si apre. */
  const openItem = (markRead: () => void, href: string) => {
    markRead();
    panelRef.current?.hidePopover();
    void navigate(href);
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
        {showsTickets && (
          <section className={styles.panelSection}>
            <p className={styles.panelTitle}>{texts.panelTitle}</p>
            {tickets.length === 0 ? (
              <p className={styles.empty}>{ticketState.status === 'error' ? texts.loadError : texts.empty}</p>
            ) : (
              <ul className={styles.ticketList}>
                {tickets.map((ticket) => {
                  const isUnread = !ticketState.readIds.has(ticket.id);
                  return (
                    <li key={ticket.id}>
                      <button
                        type="button"
                        className={styles.ticketItem}
                        data-new={isUnread || undefined}
                        onClick={() => openItem(() => ticketStore.markRead(ticket.id), disconnectionTicketHref(ticket.id))}
                      >
                        <TicketSummary ticket={ticket} isNew={isUnread} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
        {showsProtests && (
          <section className={styles.panelSection}>
            <p className={styles.panelTitle}>{protestTexts.panelTitle}</p>
            {protests.length === 0 ? (
              <p className={styles.empty}>{protestState.status === 'error' ? protestTexts.loadError : protestTexts.empty}</p>
            ) : (
              <ul className={styles.ticketList}>
                {protests.map((protest) => {
                  const isUnread = !protestState.readIds.has(protest.id);
                  return (
                    <li key={protest.id}>
                      <button
                        type="button"
                        className={styles.ticketItem}
                        data-new={isUnread || undefined}
                        onClick={() => openItem(() => protestStore.markRead(protest.id), protestHref(protest.id))}
                      >
                        <ProtestSummary protest={protest} isNew={isUnread} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
