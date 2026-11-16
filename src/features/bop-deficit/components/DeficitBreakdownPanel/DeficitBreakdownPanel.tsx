import { DefinitionList } from '@/components/ui/DefinitionList/DefinitionList';
import { LabeledProgress } from '@/components/ui/LabeledProgress/LabeledProgress';
import { Panel } from '@/components/ui/Panel/Panel';
import { useI18n } from '@/i18n/useI18n';
import { type BopDeficit, PENALTY_SECONDS_PER_UNIT_PER_LAP } from '../../model/bopDeficit';

interface DeficitBreakdownPanelProps {
  readonly bopDeficit: BopDeficit;
  readonly completedLaps: number;
  readonly totalLaps: number;
}

/** Come si arriva alla penalità: (vantaggio di peso + vantaggio di potenza) × giri × 0,5 s. */
export function DeficitBreakdownPanel({ bopDeficit, completedLaps, totalLaps }: DeficitBreakdownPanelProps) {
  const { messages, formatDecimal, formatSignedDecimal } = useI18n();
  const bopDeficitTexts = messages.bopDeficit;

  return (
    <Panel title={messages.common.calculationDetails} description={bopDeficitTexts.breakdownDescription}>
      <DefinitionList
        items={[
          { term: bopDeficitTexts.weightAdvantage, description: `${formatSignedDecimal(bopDeficit.weightAdvantageKg)} kg` },
          { term: bopDeficitTexts.powerAdvantage, description: `${formatSignedDecimal(bopDeficit.powerAdvantagePs)} PS` },
          { term: bopDeficitTexts.completedLapsTerm, description: formatDecimal(completedLaps) },
          {
            term: bopDeficitTexts.secondsPerUnitPerLap,
            description: `${formatDecimal(PENALTY_SECONDS_PER_UNIT_PER_LAP)} s`,
          },
          { term: bopDeficitTexts.calculationResult, description: `${formatDecimal(bopDeficit.totalPenaltySeconds)} s` },
        ]}
      />
      {totalLaps > 0 && (
        <LabeledProgress
          label={bopDeficitTexts.stintProgress}
          countText={bopDeficitTexts.lapsCount(formatDecimal(completedLaps), formatDecimal(totalLaps))}
          value={completedLaps}
          maximum={totalLaps}
          accessibleLabel={bopDeficitTexts.stintProgressAccessible}
        />
      )}
    </Panel>
  );
}
