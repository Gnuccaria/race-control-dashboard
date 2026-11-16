import { ToolLayout } from '@/components/layout/ToolLayout/ToolLayout';
import { UsageGuide } from '@/components/ui/UsageGuide/UsageGuide';
import { CurrentLobbyPanel } from './components/CurrentLobbyPanel/CurrentLobbyPanel';
import { RaceSettingsPanel } from './components/RaceSettingsPanel/RaceSettingsPanel';
import { ResultsColumn } from './components/ResultsColumn/ResultsColumn';
import { useI18n } from '@/i18n/useI18n';
import { useLapCalculator } from './hooks/useLapCalculator';

/** Strumento "Calcolatore di giri": compone le sezioni, nessuna logica qui. */
export function LapCalculator() {
  const { raceFormatId, selectRaceFormat, stintCount, bindField, result } = useLapCalculator();
  const { messages } = useI18n();

  return (
    <ToolLayout
      toolInfo={messages.tools.lapCalculator}
      inputsLabel={messages.lapCalculator.inputsLabel}
      inputs={
        <>
          <RaceSettingsPanel
            raceFormatId={raceFormatId}
            onRaceFormatSelect={selectRaceFormat}
            averageLapField={bindField('averageLapSeconds')}
          />
          <CurrentLobbyPanel
            currentTimeField={bindField('currentTime')}
            plannedStintEndField={bindField('plannedStintEnd')}
            completedLapsField={bindField('completedLaps')}
            totalLapsField={bindField('totalLaps')}
            currentLobbyField={bindField('currentLobby')}
            stintCount={stintCount}
          />
        </>
      }
      results={<ResultsColumn result={result} />}
      guide={<UsageGuide steps={messages.lapCalculator.usageSteps} />}
    />
  );
}
