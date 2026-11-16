import type { TicketResultDetails } from '@shared/disconnectionTicketRules';
import { DefinitionList } from '@/components/ui/DefinitionList/DefinitionList';
import { Panel } from '@/components/ui/Panel/Panel';
import { PenaltyBreakdownPanel } from '@/features/fie-disconnections/components/PenaltyBreakdownPanel/PenaltyBreakdownPanel';
import { WaitingTimeBoard } from '@/features/fie-disconnections/components/WaitingTimeBoard/WaitingTimeBoard';
import { waitingTimeFromDetails } from '@/features/fie-disconnections/model/waitingTime';
import { useI18n } from '@/i18n/useI18n';

/**
 * Risultato mandato dalla Direzione Gara: tempo di attesa, dettaglio del calcolo (lo stesso del calcolatore
 * nell'app) e valori di pista e stint usati.
 */
export function TicketResultView({ result }: { readonly result: TicketResultDetails }) {
  const { messages, formatDecimal } = useI18n();
  const texts = messages.site.ticketDetail;
  const waitingTime = waitingTimeFromDetails(result);
  return (
    <>
      <WaitingTimeBoard waitingTime={waitingTime} />
      <PenaltyBreakdownPanel
        position={result.position}
        waitingTime={waitingTime}
        gapSeconds={result.gapSeconds}
        pitStallEntrySeconds={result.pitStallEntrySeconds}
      />
      <Panel title={texts.usedValuesTitle} description={texts.usedValuesDescription}>
        <DefinitionList
          items={[
            { term: texts.trackLength, description: `${formatDecimal(result.trackLengthKm)} km` },
            { term: texts.stintLaps, description: formatDecimal(result.stintTotalLaps) },
            { term: texts.driveThrough, description: `${formatDecimal(result.driveThroughSeconds)} s` },
          ]}
        />
      </Panel>
    </>
  );
}
