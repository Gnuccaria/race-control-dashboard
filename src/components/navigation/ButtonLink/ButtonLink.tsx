import { Link, type LinkProps } from 'react-router';
import { joinClassNames } from '@/lib/joinClassNames';
import styles from './ButtonLink.module.css';

/** Link di navigazione interna con l'aspetto di un pulsante di servizio (nero, come Button primary). */
export function ButtonLink({ className, ...linkProps }: LinkProps) {
  return <Link className={joinClassNames(styles.buttonLink, className)} {...linkProps} />;
}
