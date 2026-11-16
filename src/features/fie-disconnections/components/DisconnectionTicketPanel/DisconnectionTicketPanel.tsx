import { FieldGrid } from '@/components/form/FieldGrid/FieldGrid';
import type { FieldBinding } from '@/components/form/fieldBinding';
import { NumberField } from '@/components/form/NumberField/NumberField';
import { Panel } from '@/components/ui/Panel/Panel';
import { SegmentedControl } from '@/components/ui/SegmentedControl/SegmentedControl';
import { useI18n } from '@/i18n/useI18n';
import { DISCONNECTED_POSITIONS, type DisconnectedPosition } from '../../model/waitingTime';

interface DisconnectionTicketPanelProps {
  readonly position: DisconnectedPosition;
  readonly onPositionSelect: (position: DisconnectedPosition) => void;
  readonly disconnectedOnLapField: FieldBinding;
  readonly gapField: FieldBinding;
}

/** Valori presi dal ticket della disconnessione. */
export function DisconnectionTicketPanel({
  position,
  onPositionSelect,
  disconnectedOnLapField,
  gapField,
}: DisconnectionTicketPanelProps) {
  const { messages } = useI18n();
  const disconnectionTexts = messages.fieDisconnections;
  const positionOptions = DISCONNECTED_POSITIONS.map((disconnectedPosition) => ({
    value: disconnectedPosition,
    label: disconnectionTexts.positions[disconnectedPosition].label,
    description: disconnectionTexts.positions[disconnectedPosition].gapLabel,
  }));

  return (
    <Panel title={disconnectionTexts.ticketTitle} description={disconnectionTexts.ticketDescription}>
      <SegmentedControl
        legend={disconnectionTexts.positionLegend}
        options={positionOptions}
        selectedValue={position}
        onSelect={onPositionSelect}
      />
      <FieldGrid>
        <NumberField label={disconnectionTexts.disconnectedOnLap} unit={disconnectionTexts.lapUnit} field={disconnectedOnLapField} />
        <NumberField
          label={disconnectionTexts.positions[position].gapLabel}
          unit={messages.common.seconds}
          step={0.001}
          field={gapField}
        />
      </FieldGrid>
    </Panel>
  );
}
