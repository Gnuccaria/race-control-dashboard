import type { SavedCrew } from '@shared/crewRules';
import { canPositionHaveGap, RACE_RESULT_POSITIONS } from '@shared/raceRules';
import { Input } from '@/components/ui/Input/Input';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import type { RaceDraftState } from '../../hooks/useRaceDraft';
import { CrewPositionNotice, CrewPositionTable } from '../CrewPositionTable/CrewPositionTable';

interface RaceResultsTableProps {
  readonly draft: RaceDraftState;
  readonly crewsQuery: ServerQueryState<SavedCrew[]>;
  readonly isReadOnly: boolean;
}

/**
 * Scheda "Gara": ordine di arrivo su 14 righe, con giri completati e distacco. La colonna Auto mostra la vettura che
 * resta legata alla gara: quella già salvata per le righe invariate, quella attuale dell'equipaggio per le righe nuove
 * o cambiate (vedi CrewPositionTable).
 */
export function RaceResultsTable({ draft, crewsQuery, isReadOnly }: RaceResultsTableProps) {
  const { messages, decimalSeparator } = useI18n();
  const formTexts = messages.races.form;
  const { values, check } = draft;

  return (
    <CrewPositionTable
      positionCount={RACE_RESULT_POSITIONS}
      crewsQuery={crewsQuery}
      championship={values.championship}
      isReadOnly={isReadOnly}
      description={formTexts.resultsDescription}
      crewIdAt={(position) => values.crewIdByPosition[position - 1] ?? null}
      check={check}
      texts={{ crewForPosition: formTexts.crewForPosition, clearPosition: formTexts.clearPosition }}
      onSelectCrew={draft.changeCrewAtPosition}
      onClearPosition={draft.clearPosition}
      valueColumns={[
        { header: formTexts.lapsColumn, width: 'laps' },
        { header: formTexts.gapColumn, width: 'gap' },
      ]}
      renderValues={(position, crewId) => [
        // Si compila solo dopo aver scelto l'equipaggio della posizione.
        <Input
          key="laps"
          type="text"
          inputMode="numeric"
          maxLength={3}
          aria-label={formTexts.lapsForPosition(position)}
          readOnly={isReadOnly}
          disabled={!isReadOnly && crewId === null}
          isInvalid={!isReadOnly && check.positionsOverTotalLaps.includes(position)}
          value={values.lapsTextByPosition[position - 1] ?? ''}
          onValueChange={(typedValue) => {
            draft.changeLapsAtPosition(position, typedValue);
          }}
        />,
        // Facoltativo: minuti:secondi,millesimi. Il primo non ha distacco, quindi niente campo.
        canPositionHaveGap(position) && (
          <Input
            key="gap"
            type="text"
            inputMode="decimal"
            maxLength={10}
            placeholder={isReadOnly || crewId === null ? undefined : `0:00${decimalSeparator}000`}
            aria-label={formTexts.gapForPosition(position)}
            readOnly={isReadOnly}
            disabled={!isReadOnly && crewId === null}
            isInvalid={!isReadOnly && check.positionsWithInvalidGap.includes(position)}
            value={values.gapTextByPosition[position - 1] ?? ''}
            onValueChange={(typedValue) => {
              draft.changeGapAtPosition(position, typedValue);
            }}
          />
        ),
      ]}
      footer={
        !isReadOnly && (
          <>
            {check.positionsOverTotalLaps.length > 0 && (
              <CrewPositionNotice tone="error">{formTexts.lapsOverTotal(check.positionsOverTotalLaps.length, values.totalLapsText)}</CrewPositionNotice>
            )}
            {check.positionsWithoutCar.length > 0 && <CrewPositionNotice tone="error">{formTexts.crewsWithoutCar(check.positionsWithoutCar.length)}</CrewPositionNotice>}
            {check.positionsWithInvalidGap.length > 0 && (
              <CrewPositionNotice tone="error">{formTexts.invalidGap(check.positionsWithInvalidGap.length, `1:05${decimalSeparator}320`)}</CrewPositionNotice>
            )}
            {check.positionsMissingLaps.length > 0 && <CrewPositionNotice tone="info">{formTexts.missingLaps(check.positionsMissingLaps.length)}</CrewPositionNotice>}
          </>
        )
      }
    />
  );
}
