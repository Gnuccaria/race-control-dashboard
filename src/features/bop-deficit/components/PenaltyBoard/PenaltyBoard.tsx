import { BoardFootnote } from '@/components/ui/HighlightBoard/BoardFootnote';
import { HighlightBoard } from '@/components/ui/HighlightBoard/HighlightBoard';
import type { Messages } from '@/i18n/messages';
import { useI18n } from '@/i18n/useI18n';
import type { BopDeficit } from '../../model/bopDeficit';

interface PenaltyBoardProps {
  readonly bopDeficit: BopDeficit | null;
}

function describePenalty(bopDeficit: BopDeficit | null, bopDeficitTexts: Messages['bopDeficit']): string {
  if (!bopDeficit) return bopDeficitTexts.fillHighlightedFields;
  if (bopDeficit.totalPenaltySeconds > 0) return bopDeficitTexts.penaltyToServe;
  if (bopDeficit.totalPenaltySeconds === 0) return bopDeficitTexts.noPenaltyInLine;
  return bopDeficitTexts.noPenaltyDisadvantaged;
}

/** Una penalità negativa (auto svantaggiata) viene presentata come zero; il valore esatto resta nel dettaglio. */
export function PenaltyBoard({ bopDeficit }: PenaltyBoardProps) {
  const { messages, formatDecimal } = useI18n();
  const penaltySeconds = bopDeficit ? Math.max(bopDeficit.totalPenaltySeconds, 0) : null;

  /** "1 min 7,5 s" per penalità di almeno un minuto. */
  const formatAsMinutes = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes} min ${formatDecimal(totalSeconds - minutes * 60)} s`;
  };

  return (
    <HighlightBoard
      title={messages.bopDeficit.penaltyTitle}
      figureParts={penaltySeconds === null ? null : [{ value: formatDecimal(penaltySeconds), unit: 's' }]}
    >
      <p>{describePenalty(bopDeficit, messages.bopDeficit)}</p>
      {penaltySeconds !== null && penaltySeconds >= 60 && (
        <BoardFootnote label={messages.bopDeficit.equalTo} value={formatAsMinutes(penaltySeconds)} />
      )}
    </HighlightBoard>
  );
}
