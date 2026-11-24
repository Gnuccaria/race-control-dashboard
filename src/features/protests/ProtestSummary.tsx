import type { Protest } from '@shared/protestRules';
import styles from '@/features/disconnection-tickets/components/TicketSummary/TicketSummary.module.css';
import { useI18n } from '@/i18n/useI18n';
import { crewLabel } from './crewLabel';

/** Contenuto compatto di una protesta nella campanella: numero, equipaggio, stint, giro e curva. */
export function ProtestSummary({ protest, isNew = false }: { readonly protest: Pick<Protest, 'id' | 'crew' | 'session' | 'stint' | 'lap' | 'corner'>; readonly isNew?: boolean }) {
  const { messages } = useI18n();
  const texts = messages.protests.notifications;
  return (
    <span className={styles.ticketSummary}>
      <span className={styles.titleRow}>
        <span className={styles.title}>{texts.protestTitle(protest.id)}</span>
        {isNew && <span className={styles.newLabel}>{texts.newLabel}</span>}
      </span>
      <span className={styles.crew}>{crewLabel(protest.crew)}</span>
      <span className={styles.details}>{texts.details(protest.stint, protest.lap, protest.corner)}</span>
    </span>
  );
}
