import { DefinitionList } from '@/components/ui/DefinitionList/DefinitionList';
import { Panel } from '@/components/ui/Panel/Panel';
import { useI18n } from '@/i18n/useI18n';
import type { ResultView } from '../../model/presentation';
import { PitBoard } from '../PitBoard/PitBoard';
import { ScheduleSummary } from '../ScheduleSummary/ScheduleSummary';

interface ResultsColumnProps {
  /** null quando un campo non è valido. */
  readonly result: ResultView | null;
}

export function ResultsColumn({ result }: ResultsColumnProps) {
  const { messages } = useI18n();
  const lapCalculatorTexts = messages.lapCalculator;

  return (
    <>
      <PitBoard nextLobby={result?.nextLobby ?? null} />
      {result && (
        <>
          <Panel title={lapCalculatorTexts.currentStintTitle}>
            <ScheduleSummary result={result} />
          </Panel>
          <Panel
            title={lapCalculatorTexts.referenceTitle}
            description={lapCalculatorTexts.referenceDescription}
          >
            <DefinitionList
              items={[
                { term: lapCalculatorTexts.validLapsPerStint, description: result.uncorrectedReference.validLapsPerStint },
                { term: lapCalculatorTexts.totalLapsPerLobby, description: result.uncorrectedReference.totalLapsPerLobby },
                { term: lapCalculatorTexts.totalLapsFinalLobby, description: result.uncorrectedReference.totalLapsFinalLobby },
              ]}
            />
          </Panel>
        </>
      )}
    </>
  );
}
