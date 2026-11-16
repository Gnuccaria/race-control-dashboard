import { HighlightBoard } from '@/components/ui/HighlightBoard/HighlightBoard';
import type { Messages } from '@/i18n/messages';
import { useI18n } from '@/i18n/useI18n';
import type { WaitingTime } from '../../model/waitingTime';

interface WaitingTimeBoardProps {
  readonly waitingTime: WaitingTime | null;
}

function describeWaitingTime(waitingTime: WaitingTime | null, disconnectionTexts: Messages['fieDisconnections']): string {
  if (!waitingTime) return disconnectionTexts.fillHighlightedFields;
  if (waitingTime.totalWaitSeconds <= 0) return disconnectionTexts.gapCoversPenalty;
  return disconnectionTexts.communicateToTeam;
}

/**
 * Il tempo da comunicare al team disconnesso, in minuti e secondi interi come nel foglio.
 * Un'attesa negativa (il foglio la mostrerebbe come "−5 min 36 s") viene presentata come zero.
 */
export function WaitingTimeBoard({ waitingTime }: WaitingTimeBoardProps) {
  const { messages } = useI18n();
  const hasWait = waitingTime !== null && waitingTime.totalWaitSeconds > 0;

  return (
    <HighlightBoard
      title={messages.fieDisconnections.waitingTimeTitle}
      figureParts={
        waitingTime && [
          { value: String(hasWait ? waitingTime.minutes : 0), unit: 'min' },
          { value: String(hasWait ? waitingTime.seconds : 0), unit: 's' },
        ]
      }
    >
      <p>{describeWaitingTime(waitingTime, messages.fieDisconnections)}</p>
    </HighlightBoard>
  );
}
