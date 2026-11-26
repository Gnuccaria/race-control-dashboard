import type { SavedCrew } from '@shared/crewRules';
import { canPositionHaveQ2, QUALIFYING_POSITIONS } from '@shared/qualifyingRules';
import { Input } from '@/components/ui/Input/Input';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import type { RaceDraftState } from '../../hooks/useRaceDraft';
import { CrewPositionNotice, CrewPositionTable } from '../CrewPositionTable/CrewPositionTable';

const LAP_TIME_PLACEHOLDER = '0:00.000';

interface QualifyingTableProps {
  readonly draft: RaceDraftState;
  readonly crewsQuery: ServerQueryState<SavedCrew[]>;
  readonly isReadOnly: boolean;
}

/**
 * Scheda "Qualifiche": come l'ordine di arrivo (CrewPositionTable), ma con il miglior giro in Q1 e in Q2 al posto di
 * giri e distacco. I tempi sono facoltativi; il Q2 c'è solo nelle posizioni 1–4 e 8–11. Uscendo dalla casella il
 * tempo diventa M:SS.DDD.
 */
export function QualifyingTable({ draft, crewsQuery, isReadOnly }: QualifyingTableProps) {
  const { messages } = useI18n();
  const formTexts = messages.races.form;
  const { values, check } = draft;

  const timeInput = (position: number, crewId: number | null, session: 'q1' | 'q2') => (
    <Input
      key={session}
      type="text"
      inputMode="decimal"
      maxLength={10}
      placeholder={isReadOnly || crewId === null ? undefined : LAP_TIME_PLACEHOLDER}
      aria-label={session === 'q1' ? formTexts.q1ForPosition(position) : formTexts.q2ForPosition(position)}
      readOnly={isReadOnly}
      disabled={!isReadOnly && crewId === null}
      isInvalid={!isReadOnly && check.qualifyingPositionsWithInvalidTime.includes(position)}
      value={(session === 'q1' ? values.q1TextByPosition : values.q2TextByPosition)[position - 1] ?? ''}
      onValueChange={(typedValue) => {
        draft.changeQualifyingTime(position, session, typedValue);
      }}
      onBlur={() => {
        draft.formatQualifyingTime(position, session);
      }}
    />
  );

  return (
    <CrewPositionTable
      positionCount={QUALIFYING_POSITIONS}
      crewsQuery={crewsQuery}
      championship={values.championship}
      isReadOnly={isReadOnly}
      description={formTexts.qualifyingDescription}
      tableLabel={formTexts.qualifyingTab}
      crewIdAt={(position) => values.qualifyingCrewIdByPosition[position - 1] ?? null}
      check={{
        repeatedPositions: check.qualifyingRepeatedPositions,
        carIdByPosition: check.qualifyingCarIdByPosition,
        positionsWithoutCar: check.qualifyingPositionsWithoutCar,
      }}
      texts={{ crewForPosition: formTexts.qualifyingCrewForPosition, clearPosition: formTexts.clearQualifyingPosition }}
      onSelectCrew={draft.changeQualifyingCrewAtPosition}
      onClearPosition={draft.clearQualifyingPosition}
      valueColumns={[
        { header: formTexts.q1Column, width: 'gap' },
        { header: formTexts.q2Column, width: 'gap' },
      ]}
      // Q2 solo nelle posizioni 1–4 e 8–11.
      renderValues={(position, crewId) => [timeInput(position, crewId, 'q1'), canPositionHaveQ2(position) && timeInput(position, crewId, 'q2')]}
      footer={
        !isReadOnly && (
          <>
            {check.qualifyingPositionsWithoutCar.length > 0 && (
              <CrewPositionNotice tone="error">{formTexts.crewsWithoutCar(check.qualifyingPositionsWithoutCar.length)}</CrewPositionNotice>
            )}
            {check.qualifyingPositionsWithInvalidTime.length > 0 && (
              <CrewPositionNotice tone="error">{formTexts.invalidLapTime(check.qualifyingPositionsWithInvalidTime.length)}</CrewPositionNotice>
            )}
          </>
        )
      }
    />
  );
}
