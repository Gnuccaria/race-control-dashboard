import { type DefinitionItem, DefinitionList } from '@/components/ui/DefinitionList/DefinitionList';
import { Panel } from '@/components/ui/Panel/Panel';
import { useI18n } from '@/i18n/useI18n';
import type { DisconnectedPosition, WaitingTime } from '../../model/waitingTime';

interface PenaltyBreakdownPanelProps {
  readonly position: DisconnectedPosition;
  readonly waitingTime: WaitingTime;
  readonly gapSeconds: number;
  readonly pitStallEntrySeconds: number;
}

/** Passaggi del calcolo, utili da spiegare al team. */
export function PenaltyBreakdownPanel({
  position,
  waitingTime,
  gapSeconds,
  pitStallEntrySeconds,
}: PenaltyBreakdownPanelProps) {
  const { messages, formatDecimal } = useI18n();
  const disconnectionTexts = messages.fieDisconnections;
  const formatSeconds = (seconds: number) => `${formatDecimal(seconds)} s`;
  const gapLabel = disconnectionTexts.positions[position].gapLabel;

  const positionAdjustments: DefinitionItem[] =
    position === 'leader'
      ? [
          { term: gapLabel, description: `− ${formatSeconds(gapSeconds)}` },
          { term: disconnectionTexts.pitStallEntry, description: `+ ${formatSeconds(pitStallEntrySeconds)}` },
        ]
      : [{ term: gapLabel, description: `+ ${formatSeconds(gapSeconds)}` }];

  return (
    <Panel title={messages.common.calculationDetails} description={disconnectionTexts.breakdownDescription}>
      <DefinitionList
        items={[
          { term: disconnectionTexts.missingLaps, description: formatDecimal(waitingTime.missingLaps) },
          { term: disconnectionTexts.penalty, description: formatSeconds(waitingTime.penaltySeconds) },
          ...positionAdjustments,
          { term: disconnectionTexts.waitingTime, description: formatSeconds(waitingTime.totalWaitSeconds) },
        ]}
      />
    </Panel>
  );
}
