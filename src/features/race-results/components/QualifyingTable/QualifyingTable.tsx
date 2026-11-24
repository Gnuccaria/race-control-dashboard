import { crewCarIn, type SavedCrew } from '@shared/crewRules';
import { canPositionHaveQ2, QUALIFYING_POSITIONS } from '@shared/qualifyingRules';
import { useId } from 'react';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Input } from '@/components/ui/Input/Input';
import { useCarCatalog } from '@/features/cars/useCarCatalog';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { serverErrorText } from '@/services/serverErrorText';
import { findChampionshipCrews } from '../../model/raceDraft';
import type { RaceDraftState } from '../../hooks/useRaceDraft';
import { CrewResultPicker } from '../CrewResultPicker/CrewResultPicker';
import { RaceResultCar } from '../RaceResultsTable/RaceResultsTable';
import styles from '../RaceResultsTable/RaceResultsTable.module.css';

const POSITIONS = Array.from({ length: QUALIFYING_POSITIONS }, (_, index) => index + 1);
const LAP_TIME_PLACEHOLDER = '0:00.000';

interface QualifyingTableProps {
  readonly draft: RaceDraftState;
  readonly crewsQuery: ServerQueryState<SavedCrew[]>;
  readonly isReadOnly: boolean;
}

/**
 * Scheda "Qualifiche": come l'ordine di arrivo (14 righe, solo gli equipaggi del campionato, doppioni segnalati,
 * vettura della riga), ma con il miglior giro in Q1 e in Q2 al posto di giri e distacco. I tempi sono facoltativi;
 * il Q2 c'è solo nelle posizioni 1–4 e 8–11. Uscendo dalla casella il tempo diventa M:SS.DDD.
 */
export function QualifyingTable({ draft, crewsQuery, isReadOnly }: QualifyingTableProps) {
  const { messages } = useI18n();
  const formTexts = messages.races.form;
  const errorIdPrefix = useId();
  const { values, check } = draft;
  const { carNameById } = useCarCatalog();

  if (crewsQuery.status === 'loading') return <p className={styles.notice}>{formTexts.loadingCrews}</p>;
  if (crewsQuery.status === 'failed') return <p className={styles.notice}>{serverErrorText(messages, crewsQuery.errorKind)}</p>;

  const allCrews = crewsQuery.value;
  const championshipCrews = findChampionshipCrews(allCrews, values.championship);
  const crewById = new Map(allCrews.map((crew) => [crew.id, crew]));
  const currentCarIdOf = (crewId: number) => {
    const crew = crewById.get(crewId);
    return crew && values.championship !== '' ? crewCarIn(crew, values.championship) : null;
  };
  const isTimeInvalid = (position: number) => !isReadOnly && check.qualifyingPositionsWithInvalidTime.includes(position);

  return (
    <div className={styles.raceResults}>
      {!isReadOnly && <p className={styles.notice}>{formTexts.qualifyingDescription}</p>}
      {!isReadOnly && values.championship === '' && <p className={styles.notice}>{formTexts.chooseChampionshipFirst}</p>}
      {!isReadOnly && values.championship !== '' && championshipCrews.length === 0 && <p className={styles.notice}>{formTexts.noCrewsInChampionship}</p>}
      <table className={styles.resultsTable} aria-label={formTexts.qualifyingTab}>
        <thead>
          <tr>
            <th scope="col" className={styles.positionColumn}>
              {formTexts.positionColumn}
            </th>
            <th scope="col">{formTexts.crewColumn}</th>
            <th scope="col" className={styles.carColumn}>
              {formTexts.carColumn}
            </th>
            <th scope="col" className={styles.gapColumn}>
              {formTexts.q1Column}
            </th>
            <th scope="col" className={styles.gapColumn}>
              {formTexts.q2Column}
            </th>
            {!isReadOnly && (
              <th scope="col" className={styles.clearColumn}>
                <span className={styles.visuallyHidden}>{formTexts.clearColumn}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {POSITIONS.map((position) => {
            const crewId = values.qualifyingCrewIdByPosition[position - 1] ?? null;
            const firstPosition = check.qualifyingRepeatedPositions.get(position);
            const errorId = `${errorIdPrefix}-${position}`;
            const timeInput = (session: 'q1' | 'q2') => (
              <Input
                type="text"
                inputMode="decimal"
                maxLength={10}
                placeholder={isReadOnly || crewId === null ? undefined : LAP_TIME_PLACEHOLDER}
                aria-label={session === 'q1' ? formTexts.q1ForPosition(position) : formTexts.q2ForPosition(position)}
                readOnly={isReadOnly}
                disabled={!isReadOnly && crewId === null}
                isInvalid={isTimeInvalid(position)}
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
              <tr key={position}>
                <td className={styles.positionCell}>{position}</td>
                <td>
                  <CrewResultPicker
                    crews={championshipCrews}
                    selectedCrew={crewId === null ? null : (crewById.get(crewId) ?? null)}
                    onSelectCrew={(selectedCrewId) => {
                      draft.changeQualifyingCrewAtPosition(position, selectedCrewId);
                    }}
                    label={formTexts.qualifyingCrewForPosition(position)}
                    placeholder={isReadOnly ? '–' : formTexts.crewPlaceholder}
                    clearLabel={formTexts.noCrew}
                    disabled={isReadOnly || values.championship === ''}
                    isInvalid={firstPosition !== undefined}
                    aria-describedby={firstPosition !== undefined ? errorId : undefined}
                  />
                  {firstPosition !== undefined && (
                    <p id={errorId} className={styles.repeatedMessage}>
                      {formTexts.repeatedCrew(firstPosition)}
                    </p>
                  )}
                </td>
                <td className={styles.carCell}>
                  <RaceResultCar
                    crewCarId={crewId === null ? undefined : currentCarIdOf(crewId)}
                    raceCarId={check.qualifyingCarIdByPosition.get(position)}
                    isMissing={!isReadOnly && check.qualifyingPositionsWithoutCar.includes(position)}
                    carNameById={carNameById}
                  />
                </td>
                <td className={styles.lapsCell}>{timeInput('q1')}</td>
                {/* Q2 solo nelle posizioni 1–4 e 8–11. */}
                <td className={styles.lapsCell}>{canPositionHaveQ2(position) && timeInput('q2')}</td>
                {!isReadOnly && (
                  <td className={styles.clearCell}>
                    <IconButton
                      accessibleLabel={formTexts.clearQualifyingPosition(position)}
                      title={formTexts.clearQualifyingPosition(position)}
                      className={styles.clearButton}
                      disabled={crewId === null}
                      onClick={() => {
                        draft.clearQualifyingPosition(position);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <path d="m3.5 3.5 7 7m0-7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </IconButton>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!isReadOnly && check.qualifyingPositionsWithoutCar.length > 0 && (
        <p className={styles.errorNotice} role="alert">
          {formTexts.crewsWithoutCar(check.qualifyingPositionsWithoutCar.length)}
        </p>
      )}
      {!isReadOnly && check.qualifyingPositionsWithInvalidTime.length > 0 && (
        <p className={styles.errorNotice} role="alert">
          {formTexts.invalidLapTime(check.qualifyingPositionsWithInvalidTime.length)}
        </p>
      )}
    </div>
  );
}
