import { useEffect, useState } from 'react';
import { fetchTicketAvailability } from '../api/disconnectionTickets';

const REFRESH_INTERVAL_MS = 10_000;

/**
 * Invio dei ticket aperto o chiuso (lo decide la Direzione Gara dall'app): letto all'apertura della pagina,
 * ogni 10 secondi e quando la scheda torna in primo piano. null finché non si sa.
 */
export function useTicketAvailability(): boolean | null {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void fetchTicketAvailability().then((availability) => {
        if (isCurrent) setIsOpen(availability.isOpen);
      });
    };
    void fetchTicketAvailability().then((availability) => {
      if (isCurrent) setIsOpen(availability.isOpen);
    });
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      isCurrent = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return isOpen;
}
