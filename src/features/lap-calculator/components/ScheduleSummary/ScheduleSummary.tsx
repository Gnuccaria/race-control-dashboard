import { DefinitionList } from '@/components/ui/DefinitionList/DefinitionList';
import { LabeledProgress } from '@/components/ui/LabeledProgress/LabeledProgress';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge/StatusBadge';
import { useI18n } from '@/i18n/useI18n';
import type { ResultView, ScheduleStatus } from '../../model/presentation';
import styles from './ScheduleSummary.module.css';

const STATUS_TONES: Record<ScheduleStatus, StatusTone> = {
  'on-time': 'positive',
  early: 'warning',
  late: 'critical',
};

interface ScheduleSummaryProps {
  readonly result: ResultView;
}

/** Stato dello stint corrente: scarto, orari a confronto e giri validi percorsi. */
export function ScheduleSummary({ result }: ScheduleSummaryProps) {
  const { scheduleStatus, deviation, completedValidLaps, totalValidLaps } = result;
  const { messages } = useI18n();
  const lapCalculatorTexts = messages.lapCalculator;

  return (
    <div className={styles.scheduleSummary}>
      <p className={styles.statusLine} aria-live="polite">
        <StatusBadge tone={STATUS_TONES[scheduleStatus]}>{lapCalculatorTexts.scheduleStatus[scheduleStatus]}</StatusBadge>
        {deviation && <span className={styles.deviationAmount}>{lapCalculatorTexts.deviationBy(deviation)}</span>}
      </p>
      <DefinitionList
        layout="columns"
        items={[
          { term: lapCalculatorTexts.plannedEnd, description: result.plannedEnd },
          { term: lapCalculatorTexts.estimatedEnd, description: result.estimatedEnd },
        ]}
      />
      <LabeledProgress
        label={lapCalculatorTexts.completedValidLaps}
        countText={messages.common.countOf(String(completedValidLaps), String(totalValidLaps))}
        value={completedValidLaps}
        maximum={totalValidLaps}
        accessibleLabel={lapCalculatorTexts.completedValidLapsProgress}
      />
    </div>
  );
}
