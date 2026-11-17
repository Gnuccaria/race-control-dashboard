import { useUnreadNotificationCount, withUnreadCount } from '@/lib/unreadNotificationCount';

/** Titolo della scheda/finestra della pagina, preceduto dal numero di notifiche non lette: "(3) Race Control …". */
export function DocumentTitle({ title }: { readonly title: string }) {
  const unreadCount = useUnreadNotificationCount();
  return <title>{withUnreadCount(title, unreadCount)}</title>;
}
