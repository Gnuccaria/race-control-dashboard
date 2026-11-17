import { crewCarIn, type SavedCrew } from '@shared/crewRules';
import { canPositionHaveGap, RACE_RESULT_POSITIONS } from '@shared/raceRules';
import { useId } from 'react';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Input } from '@/components/ui/Input/Input';
import { useCarCatalog } from '@/features/cars/useCarCatalog';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { findChampionshipCrews } from '../../model/raceDraft';
import type { RaceDraftState } from '../../hooks/useRaceDraft';
import { CrewResultPicker } from '../CrewResultPicker/CrewResultPicker';
import styles from './RaceResultsTable.module.css';

const POSITIONS = Array.from({ length: RACE_RESULT_POSITIONS }, (_, index) => index + 1);

interface RaceResultsTableProps {
  readonly draft: RaceDraftState;
  readonly crewsQuery: ServerQueryState<SavedCrew[]>;
  readonly isReadOnly: boolean;
}

/**
 * Scheda "Dettagli": ordine di arrivo su 14 righe. Ogni menu propone solo gli equipaggi del campionato;
 * un equipaggio già inserito più in alto viene sottolineato in rosso con il rimando alla prima posizione.
 * La colonna Auto mostra la vettura che resta legata alla gara: quella già salvata per le righe invariate,
 * quella attuale dell'equipaggio per le righe nuove o cambiate.
 */
export function RaceResultsTable({ draft, crewsQuery, isReadOnly }: RaceResultsTableProps) {
  const { messages, decimalSeparator } = useI18n();
  const formTexts = messages.races.form;
  const errorIdPrefix = useId();
  const { values, check } = draft;
  const { carNameById } = useCarCatalog();

  if (crewsQuery.status === 'loading') return <p className={styles.notice}>{formTexts.loadingCrews}</p>;
  if (crewsQuery.status === 'failed') return <p className={styles.notice}>{messages.serverErrors[crewsQuery.errorKind]}</p>;

  const allCrews = crewsQuery.value;
  const championshipCrews = findChampionshipCrews(allCrews, values.championship);
  const crewById = new Map(allCrews.map((crew) => [crew.id, crew]));
  /** Auto attuale dell'equipaggio nel campionato della gara. */
  const currentCarIdOf = (crewId: number) => {
    const crew = crewById.get(crewId);
    return crew && values.championship !== '' ? crewCarIn(crew, values.championship) : null;
  };

  return (
    <div className={styles.raceResults}>
      {!isReadOnly && <p className={styles.notice}>{formTexts.resultsDescription}</p>}
      {!isReadOnly && values.championship === '' && <p className={styles.notice}>{formTexts.chooseChampionshipFirst}</p>}
      {!isReadOnly && values.championship !== '' && championshipCrews.length === 0 && (
        <p className={styles.notice}>{formTexts.noCrewsInChampionship}</p>
      )}
      <table className={styles.resultsTable}>
        <thead>
          <tr>
            <th scope="col" className={styles.positionColumn}>
              {formTexts.positionColumn}
            </th>
            <th scope="col">{formTexts.crewColumn}</th>
            <th scope="col" className={styles.carColumn}>
              {formTexts.carColumn}
            </th>
            <th scope="col" className={styles.lapsColumn}>
              {formTexts.lapsColumn}
            </th>
            <th scope="col" className={styles.gapColumn}>
              {formTexts.gapColumn}
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
            const crewId = values.crewIdByPosition[position - 1] ?? null;
            const firstPosition = check.repeatedPositions.get(position);
            const errorId = `${errorIdPrefix}-${position}`;
            return (
              <tr key={position}>
                <td className={styles.positionCell}>{position}</td>
                <td>
                  <CrewResultPicker
                    crews={championshipCrews}
                    selectedCrew={crewId === null ? null : (crewById.get(crewId) ?? null)}
                    onSelectCrew={(selectedCrewId) => {
                      draft.changeCrewAtPosition(position, selectedCrewId);
                    }}
                    label={formTexts.crewForPosition(position)}
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
                    raceCarId={check.carIdByPosition.get(position)}
                    isMissing={!isReadOnly && check.positionsWithoutCar.includes(position)}
                    carNameById={carNameById}
                  />
                </td>
                <td className={styles.lapsCell}>
                  {/* Si compila solo dopo aver scelto l'equipaggio della posizione. */}
                  <Input
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
                  />
                </td>
                <td className={styles.lapsCell}>
                  {/* Facoltativo: minuti:secondi,millesimi. Il primo non ha distacco, quindi niente campo. */}
                  {canPositionHaveGap(position) && (
                  <Input
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
                  )}
                </td>
                {!isReadOnly && (
                  <td className={styles.clearCell}>
                    <IconButton
                      accessibleLabel={formTexts.clearPosition(position)}
                      title={formTexts.clearPosition(position)}
                      className={styles.clearButton}
                      disabled={crewId === null}
                      onClick={() => {
                        draft.clearPosition(position);
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
      {!isReadOnly && check.positionsOverTotalLaps.length > 0 && (
        <p className={styles.errorNotice} role="alert">
          {formTexts.lapsOverTotal(check.positionsOverTotalLaps.length, values.totalLapsText)}
        </p>
      )}
      {!isReadOnly && check.positionsWithoutCar.length > 0 && (
        <p className={styles.errorNotice} role="alert">
          {formTexts.crewsWithoutCar(check.positionsWithoutCar.length)}
        </p>
      )}
      {!isReadOnly && check.positionsWithInvalidGap.length > 0 && (
        <p className={styles.errorNotice} role="alert">
          {formTexts.invalidGap(check.positionsWithInvalidGap.length, `1:05${decimalSeparator}320`)}
        </p>
      )}
      {!isReadOnly && check.positionsMissingLaps.length > 0 && (
        <p className={styles.notice} role="status">
          {formTexts.missingLaps(check.positionsMissingLaps.length)}
        </p>
      )}
    </div>
  );
}

interface RaceResultCarProps {
  /** Auto attuale dell'equipaggio della riga; undefined = riga vuota. */
  readonly crewCarId: number | null | undefined;
  /** Auto che resta legata alla gara per questa riga. */
  readonly raceCarId: number | null | undefined;
  /** L'equipaggio dovrebbe portare la sua auto attuale ma non ne ha una: blocca il salvataggio. */
  readonly isMissing: boolean;
  readonly carNameById: ReadonlyMap<number, string>;
}

/** Vettura di una riga dell'ordine di arrivo; se diversa da quella attuale dell'equipaggio, lo dice al passaggio del mouse. */
function RaceResultCar({ crewCarId, raceCarId, isMissing, carNameById }: RaceResultCarProps) {
  const { messages } = useI18n();
  const formTexts = messages.races.form;
  if (crewCarId === undefined || raceCarId === undefined) return <span className={styles.emptyCar}>–</span>;
  if (raceCarId === null) {
    return <span className={isMissing ? styles.missingCar : styles.emptyCar}>{formTexts.carMissing}</span>;
  }
  const carName = carNameById.get(raceCarId) ?? messages.cars.unknownCar;
  const currentCarName = crewCarId === null ? null : (carNameById.get(crewCarId) ?? null);
  const isHistoricCar = crewCarId !== raceCarId;
  return (
    <span
      className={isHistoricCar ? styles.historicCar : undefined}
      title={isHistoricCar ? formTexts.carUsedInRace(currentCarName ?? formTexts.carMissing.toLowerCase()) : undefined}
    >
      {carName}
    </span>
  );
}
