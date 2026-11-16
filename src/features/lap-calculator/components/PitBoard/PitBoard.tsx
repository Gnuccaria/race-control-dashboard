import { BoardFootnote } from '@/components/ui/HighlightBoard/BoardFootnote';
import { HighlightBoard } from '@/components/ui/HighlightBoard/HighlightBoard';
import type { Messages } from '@/i18n/messages';
import { useI18n } from '@/i18n/useI18n';
import type { NextLobbyView } from '../../model/presentation';

interface PitBoardProps {
  readonly nextLobby: NextLobbyView | null;
}

function describeLapBreakdown(nextLobby: NextLobbyView | null, lapCalculatorTexts: Messages['lapCalculator']): string {
  if (!nextLobby) return lapCalculatorTexts.fillHighlightedFields;
  if (nextLobby.kind === 'none') return lapCalculatorTexts.finalLobbyRunning;
  if (nextLobby.isFinalLobby) return lapCalculatorTexts.nextIsFinalLobby(nextLobby.validLaps);
  return lapCalculatorTexts.nextLobbyBreakdown(nextLobby.validLaps);
}

/** Giri da impostare nella lobby successiva, da leggere a colpo d'occhio durante la gara. */
export function PitBoard({ nextLobby }: PitBoardProps) {
  const { messages } = useI18n();
  const upcomingLobby = nextLobby?.kind === 'upcoming' ? nextLobby : null;

  return (
    <HighlightBoard
      title={messages.lapCalculator.lapsToSetTitle}
      figureParts={upcomingLobby ? [{ value: String(upcomingLobby.lapsToSet) }] : null}
    >
      <p>{describeLapBreakdown(nextLobby, messages.lapCalculator)}</p>
      {upcomingLobby && (
        <BoardFootnote label={messages.lapCalculator.nextStintPlannedEnd} value={upcomingLobby.plannedEnd} />
      )}
    </HighlightBoard>
  );
}
