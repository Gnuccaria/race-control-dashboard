import type { DisconnectionTicket } from '@shared/disconnectionTicketRules';
import { describe, expect, it } from 'vitest';
import { createTicketStore, unreadTickets } from './ticketStoreCore';

const ticket = (id: number): DisconnectionTicket => ({
  id,
  crewId: 1,
  crewNumber: 16,
  crewName: 'Vez Team Lime',
  position: 3,
  gapMs: 83_456,
  disconnectedOnLap: 12,
  submittedByName: 'Niko',
  submittedByUsername: 'niko_rc',
  createdAt: '2026-11-15T21:00:00.000Z',
});

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), values };
}

describe('ticket da gestire', () => {
  it('ogni ticket è una notifica non letta finché non la si clicca; le lette si ricordano una per una', async () => {
    const storage = memoryStorage({ 'disconnection-tickets:read-ids': '[1]' });
    let serverTickets = [ticket(1), ticket(2), ticket(3)];
    const store = createTicketStore(() => Promise.resolve({ isSuccess: true, value: serverTickets }), storage);
    await store.refresh();
    expect(unreadTickets(store.getState()).map((item) => item.id)).toEqual([2, 3]);

    // Il clic su una notifica segna come letta solo quella.
    store.markRead(3);
    expect(unreadTickets(store.getState()).map((item) => item.id)).toEqual([2]);
    expect(storage.values.get('disconnection-tickets:read-ids')).toBe('[1,3]');

    serverTickets = [ticket(2), ticket(3), ticket(4)];
    await store.refresh();
    expect(unreadTickets(store.getState()).map((item) => item.id)).toEqual([2, 4]);

    // Alla prossima apertura dell'app le lette sono ancora lette.
    const nextStart = createTicketStore(() => Promise.resolve({ isSuccess: true, value: serverTickets }), storage);
    await nextStart.refresh();
    expect(unreadTickets(nextStart.getState()).map((item) => item.id)).toEqual([2, 4]);
  });

  it('un ticket gestito sparisce subito; un errore di lettura tiene i ticket già letti', async () => {
    let shouldFail = false;
    const store = createTicketStore(
      () => Promise.resolve(shouldFail ? { isSuccess: false, errorKind: 'server-unreachable' } : { isSuccess: true, value: [ticket(4), ticket(5)] }),
      null,
    );
    await store.refresh();
    store.removeTicket(4);
    expect(store.getState().tickets.map((item) => item.id)).toEqual([5]);
    shouldFail = true;
    await store.refresh();
    expect(store.getState()).toMatchObject({ status: 'error', tickets: [{ id: 5 }] });
  });
});
