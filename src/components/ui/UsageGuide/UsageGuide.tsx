import { useI18n } from '@/i18n/useI18n';
import styles from './UsageGuide.module.css';

interface UsageGuideProps {
  /** Passi in ordine: sono una sequenza, quindi vengono numerati. */
  readonly steps: readonly string[];
}

/** Istruzioni richiudibili: utili la prima volta, poi non ingombrano. */
export function UsageGuide({ steps }: UsageGuideProps) {
  const { messages } = useI18n();

  return (
    <details className={styles.usageGuide}>
      <summary className={styles.usageGuideToggle}>{messages.common.usageGuide}</summary>
      <ol className={styles.usageStepList}>
        {steps.map((stepText) => (
          <li key={stepText} className={styles.usageStep}>
            {stepText}
          </li>
        ))}
      </ol>
    </details>
  );
}
