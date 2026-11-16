import { ToolLayout } from '@/components/layout/ToolLayout/ToolLayout';
import { UsageGuide } from '@/components/ui/UsageGuide/UsageGuide';
import { CarValuesPanel } from './components/CarValuesPanel/CarValuesPanel';
import { DeficitBreakdownPanel } from './components/DeficitBreakdownPanel/DeficitBreakdownPanel';
import { PenaltyBoard } from './components/PenaltyBoard/PenaltyBoard';
import { StintLapsPanel } from './components/StintLapsPanel/StintLapsPanel';
import { useI18n } from '@/i18n/useI18n';
import { useBopDeficitCalculator } from './hooks/useBopDeficitCalculator';

/** Strumento "Calcolatore deficit BoP": compone le sezioni, nessuna logica qui. */
export function BopDeficitCalculator() {
  const { bindField, bopDeficit, completedLaps, totalLaps } = useBopDeficitCalculator();
  const { messages } = useI18n();

  return (
    <ToolLayout
      toolInfo={messages.tools.bopDeficit}
      inputsLabel={messages.bopDeficit.inputsLabel}
      inputs={
        <>
          <CarValuesPanel
            bopWeightField={bindField('bopWeightKg')}
            actualWeightField={bindField('actualWeightKg')}
            bopPowerField={bindField('bopPowerPs')}
            actualPowerField={bindField('actualPowerPs')}
          />
          <StintLapsPanel completedLapsField={bindField('completedLaps')} totalLapsField={bindField('totalLaps')} />
        </>
      }
      results={
        <>
          <PenaltyBoard bopDeficit={bopDeficit} />
          {bopDeficit && (
            <DeficitBreakdownPanel bopDeficit={bopDeficit} completedLaps={completedLaps} totalLaps={totalLaps} />
          )}
        </>
      }
      guide={<UsageGuide steps={messages.bopDeficit.usageSteps} />}
    />
  );
}
