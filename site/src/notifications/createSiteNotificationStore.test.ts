import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSiteNotificationStore } from './createSiteNotificationStore';

vi.mock('../auth/siteAuthStore', () => ({
  getFreshSiteAccessToken: vi.fn(() => Promise.resolve('site-token')),
  endExpiredSiteSession: vi.fn(),
}));

interface Item {
  readonly id: number;
  readonly status: 'open' | 'rejected';
}

describe('notifiche del sito', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('solo gli elementi da notificare e non visti sono notifiche; i visti si ricordano per account', async () => {
    let serverItems: Item[] = [
      { id: 2, status: 'rejected' },
      { id: 1, status: 'open' },
    ];
    const createStore = () =>
      createSiteNotificationStore<Item>({
        seenKeyPrefix: 'test-seen:',
        fetchItems: () => Promise.resolve({ isSuccess: true, value: serverItems }),
        isNotification: (item) => item.status === 'rejected',
      });
    const store = createStore();
    const unseenIds = () => store.unseen(store.getState()).map((item) => item.id);

    await store.refresh('user-1');
    expect(unseenIds()).toEqual([2]);

    store.markSeen([2]);
    expect(unseenIds()).toEqual([]);
    expect(localStorage.getItem('test-seen:user-1')).toBe('[2]');

    serverItems = [{ id: 3, status: 'rejected' }, ...serverItems];
    await store.refresh('user-1');
    expect(unseenIds()).toEqual([3]);

    // Un altro account nello stesso browser ha le sue notifiche viste.
    await store.refresh('user-2');
    expect(unseenIds()).toEqual([3, 2]);

    // Una nuova visita ritrova le notifiche già viste dal primo account.
    const nextVisit = createStore();
    await nextVisit.refresh('user-1');
    expect(nextVisit.unseen(nextVisit.getState()).map((item) => item.id)).toEqual([3]);
  });
});
