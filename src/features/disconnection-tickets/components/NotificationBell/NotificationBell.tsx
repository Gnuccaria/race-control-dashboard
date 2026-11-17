import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { AppAccess } from '@/features/auth/model/discordProfile';
import { ProtestSummary } from '@/features/protests/ProtestSummary';
import { protestHref, protestStore, unseenProtests, useProtestState } from '@/features/protests/protestStore';
import { useI18n } from '@/i18n/useI18n';
import { disconnectionTicketHref } from '../../ticketPaths';
import { startTaskbarBadge } from '../../taskbarBadge';
import { ticketStore, unseenTickets, useTicketState } from '../../ticketStore';
import { BellIcon } from '../BellIcon/BellIcon';
import { TicketSummary } from '../TicketSummary/TicketSummary';
import styles from './NotificationBell.module.css';

/** Proteste in esame mostrate nella tendina (le più recenti). */
const MAX_SHOWN_PROTESTS = 10;

/**
 * Campanella accanto al profilo, con una sezione per ruolo:
 * - Direzione Gara: i ticket di disconnessione da gestire; il clic apre il calcolatore con il ticket già compilato;
 * - Commissari Sportivi: le proteste in esame; il clic apre la protesta in "Gestisci proteste".
 * Il numero è quello delle notifiche non ancora viste (ticket e proteste nuove), anche sull'icona dell'app.
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
  // Le notifiche nuove al momento dell'apertura restano segnate finché la tendina è aperta.
  const [newTicketIds, setNewTicketIds] = useState<ReadonlySet<number>>(new Set());
  const [newProtestIds, setNewProtestIds] = useState<ReadonlySet<number>>(new Set());
  const { raceControl: showsTickets, stewards: showsProtests } = access;
  const unseenCount = (showsTickets ? unseenTickets(ticketState).length : 0) + (showsProtests ? unseenProtests(protestState).length : 0);

  useEffect(() => (showsTickets ? ticketStore.startPolling() : undefined), [showsTickets]);
  useEffect(() => (showsProtests ? protestStore.startPolling() : undefined), [showsProtests]);
  // Stesso numero anche sull'icona dell'app nella barra delle applicazioni.
  useEffect(() => startTaskbarBadge({ raceControl: showsTickets, stewards: showsProtests }), [showsTickets, showsProtests]);

  const tickets = [...ticketState.tickets].reverse();
  const protests = protestState.tickets.filter((protest) => protest.status === 'open').slice(0, MAX_SHOWN_PROTESTS);

  const openItem = (href: string) => {
    panelRef.current?.hidePopover();
    void navigate(href);
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
          if (showsTickets) {
            setNewTicketIds(new Set(unseenTickets(ticketStore.getState()).map((ticket) => ticket.id)));
            ticketStore.markAllSeen();
          }
          if (showsProtests) {
            setNewProtestIds(new Set(unseenProtests(protestStore.getState()).map((protest) => protest.id)));
            protestStore.markAllSeen();
          }
        }}
      >
        {showsTickets && (
          <section className={styles.panelSection}>
            <p className={styles.panelTitle}>{texts.panelTitle}</p>
            {tickets.length === 0 ? (
              <p className={styles.empty}>{ticketState.status === 'error' ? texts.loadError : texts.empty}</p>
            ) : (
              <ul className={styles.ticketList}>
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      className={styles.ticketItem}
                      data-new={newTicketIds.has(ticket.id) || undefined}
                      onClick={() => openItem(disconnectionTicketHref(ticket.id))}
                    >
                      <TicketSummary ticket={ticket} isNew={newTicketIds.has(ticket.id)} />
                    </button>
                  </li>
                ))}
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
                {protests.map((protest) => (
                  <li key={protest.id}>
                    <button
                      type="button"
                      className={styles.ticketItem}
                      data-new={newProtestIds.has(protest.id) || undefined}
                      onClick={() => openItem(protestHref(protest.id))}
                    >
                      <ProtestSummary protest={protest} isNew={newProtestIds.has(protest.id)} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
