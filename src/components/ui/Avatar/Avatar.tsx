import { joinClassNames } from '@/lib/joinClassNames';
import { UserIcon } from '../Icon/UserIcon';
import styles from './Avatar.module.css';

interface AvatarProps {
  readonly imageUrl: string;
  readonly size?: 'small' | 'medium';
}

/**
 * Immagine del profilo, rotonda. Decorativa (alt vuoto): il nome dell'utente
 * è sempre presente accanto o nell'etichetta del pulsante che la contiene.
 */
export function Avatar({ imageUrl, size = 'small' }: AvatarProps) {
  return (
    <img
      src={imageUrl}
      alt=""
      referrerPolicy="no-referrer"
      draggable={false}
      className={joinClassNames(styles.avatar, size === 'medium' && styles.mediumAvatar)}
    />
  );
}

/** Al posto della foto quando non c'è un utente collegato (sito pubblico): sagoma generica. */
export function GuestAvatar() {
  return (
    <span aria-hidden="true" className={joinClassNames(styles.avatar, styles.guestAvatar)}>
      <UserIcon />
    </span>
  );
}
