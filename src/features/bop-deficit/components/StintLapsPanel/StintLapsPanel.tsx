import type { FieldBinding } from '@/components/form/fieldBinding';
import { FractionInput } from '@/components/form/FractionInput/FractionInput';
import { Panel } from '@/components/ui/Panel/Panel';
import { useI18n } from '@/i18n/useI18n';

interface StintLapsPanelProps {
  readonly completedLapsField: FieldBinding;
  readonly totalLapsField: FieldBinding;
}

export function StintLapsPanel({ completedLapsField, totalLapsField }: StintLapsPanelProps) {
  const { messages } = useI18n();
  const bopDeficitTexts = messages.bopDeficit;

  return (
    <Panel title={bopDeficitTexts.stintTitle}>
      <FractionInput
        legend={bopDeficitTexts.stintLapsLegend}
        hint={bopDeficitTexts.stintLapsHint}
        numerator={{ label: bopDeficitTexts.completedLaps, field: completedLapsField }}
        denominator={{ label: bopDeficitTexts.totalLaps, field: totalLapsField }}
      />
    </Panel>
  );
}
