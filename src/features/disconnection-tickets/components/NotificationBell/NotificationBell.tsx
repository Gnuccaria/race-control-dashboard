import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/i18n/useI18n';
import { disconnectionTicketHref } from '../../ticketPaths';
import { startTaskbarBadge } from '../../taskbarBadge';
import { ticketStore, unseenTickets, useTicketState } from '../../ticketStore';
import { BellIcon } from '../BellIcon/BellIcon';
import { TicketSummary } from '../TicketSummary/TicketSummary';
import styles from './NotificationBell.module.css';

/**
 * Campanella accanto al profilo: il numero dei ticket di disconnessione arrivati e non ancora visti.
 * La tendina elenca i ticket da gestire (i nuovi segnati); il clic su uno apre il calcolatore disconnessioni
 * con quel ticket già compilato.
 */
export function NotificationBell() {
  const { messages } = useI18n();
  const texts = messages.disconnectionTickets;
  const ticketState = useTicketState();
  const navigate = useNavigate();
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // I ticket nuovi al momento dell'apertura restano segnati finché la tendina è aperta.
  const [newTicketIds, setNewTicketIds] = useState<ReadonlySet<number>>(new Set());
  const unseenCount = unseenTickets(ticketState).length;

  useEffect(() => ticketStore.startPolling(), []);
  // Stesso numero anche sull'icona dell'app nella barra delle applicazioni.
  useEffect(() => startTaskbarBadge(), []);

  const tickets = [...ticketState.tickets].reverse();

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
          setNewTicketIds(new Set(unseenTickets(ticketStore.getState()).map((ticket) => ticket.id)));
          ticketStore.markAllSeen();
        }}
      >
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
                  onClick={() => {
                    panelRef.current?.hidePopover();
                    void navigate(disconnectionTicketHref(ticket.id));
                  }}
                >
                  <TicketSummary ticket={ticket} isNew={newTicketIds.has(ticket.id)} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
