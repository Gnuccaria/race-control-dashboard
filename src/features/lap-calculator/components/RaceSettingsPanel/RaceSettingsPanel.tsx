import type { FieldBinding } from '@/components/form/fieldBinding';
import { NumberField } from '@/components/form/NumberField/NumberField';
import { Panel } from '@/components/ui/Panel/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl';
import { useI18n } from '@/i18n/useI18n';
import { getStintCount, RACE_FORMATS, type RaceFormatId } from '../../model/raceFormats';

interface RaceSettingsPanelProps {
  readonly raceFormatId: RaceFormatId;
  readonly onRaceFormatSelect: (raceFormatId: RaceFormatId) => void;
  readonly averageLapField: FieldBinding;
}

/** Impostazioni fisse per tutta la gara. */
export function RaceSettingsPanel({ raceFormatId, onRaceFormatSelect, averageLapField }: RaceSettingsPanelProps) {
  const { messages } = useI18n();
  const raceFormatOptions = RACE_FORMATS.map((raceFormat) => ({
    value: raceFormat.id,
    label: messages.lapCalculator.raceFormatLabel(raceFormat.hours),
    description: `${getStintCount(raceFormat)} × ${raceFormat.stintMinutes} min`,
  }));

  return (
    <Panel title={messages.lapCalculator.raceSettingsTitle} description={messages.lapCalculator.raceSettingsDescription}>
      <SegmentedControl
        legend={messages.lapCalculator.raceFormatLegend}
        options={raceFormatOptions}
        selectedValue={raceFormatId}
        onSelect={onRaceFormatSelect}
      />
      <NumberField label={messages.lapCalculator.averageLap} unit={messages.common.seconds} step={0.1} field={averageLapField} />
    </Panel>
  );
}
