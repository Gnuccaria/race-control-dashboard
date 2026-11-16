import type { FieldBinding } from '@/components/form/fieldBinding';
import { FormField } from '@/components/form/FormField/FormField';
import { FractionInput } from '@/components/form/FractionInput/FractionInput';
import { NumberStepper } from '@/components/form/NumberStepper/NumberStepper';
import { TimeField } from '@/components/form/TimeField/TimeField';
import { Panel } from '@/components/ui/Panel/Panel';
import { useI18n } from '@/i18n/useI18n';
import styles from './CurrentLobbyPanel.module.css';

interface CurrentLobbyPanelProps {
  readonly currentTimeField: FieldBinding;
  readonly plannedStintEndField: FieldBinding;
  readonly completedLapsField: FieldBinding;
  readonly totalLapsField: FieldBinding;
  readonly currentLobbyField: FieldBinding;
  readonly stintCount: number;
}

/** Valori da aggiornare a ogni verifica durante la gara. */
export function CurrentLobbyPanel({
  currentTimeField,
  plannedStintEndField,
  completedLapsField,
  totalLapsField,
  currentLobbyField,
  stintCount,
}: CurrentLobbyPanelProps) {
  const { messages } = useI18n();
  const lapCalculatorTexts = messages.lapCalculator;

  return (
    <Panel title={lapCalculatorTexts.currentLobbyTitle} description={lapCalculatorTexts.currentLobbyDescription}>
      <div className={styles.timeFields}>
        <TimeField label={lapCalculatorTexts.currentTime} field={currentTimeField} />
        <TimeField
          label={lapCalculatorTexts.plannedStintEnd}
          hint={lapCalculatorTexts.plannedStintEndHint}
          field={plannedStintEndField}
        />
      </div>
      <div className={styles.lobbyFields}>
        <FractionInput
          legend={lapCalculatorTexts.lobbyCounterLegend}
          hint={lapCalculatorTexts.lobbyCounterHint}
          numerator={{ label: lapCalculatorTexts.completedLaps, field: completedLapsField }}
          denominator={{ label: lapCalculatorTexts.totalLaps, field: totalLapsField }}
        />
        <FormField label={lapCalculatorTexts.lobbyNumber} errorMessage={currentLobbyField.errorMessage}>
          {(controlProps) => (
            <NumberStepper
              field={currentLobbyField}
              controlProps={controlProps}
              minimum={1}
              maximum={stintCount}
              decrementLabel={lapCalculatorTexts.previousLobby}
              incrementLabel={lapCalculatorTexts.nextLobby}
              suffix={lapCalculatorTexts.lobbyOfTotal(stintCount)}
            />
          )}
        </FormField>
      </div>
    </Panel>
  );
}
