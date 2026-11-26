import { crewCarIn, type SavedCrew } from '@shared/crewRules';
import { type ReactNode, useId } from 'react';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { useCarCatalog } from '@/features/cars/useCarCatalog';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { crewsQueryNotice } from '../../model/crewsQueryNotice';
import { findChampionshipCrews } from '../../model/raceDraft';
import { CrewResultPicker } from '../CrewResultPicker/CrewResultPicker';
import styles from './CrewPositionTable.module.css';
import { RaceResultCar } from './RaceResultCar';

export interface CrewPositionColumn {
  readonly header: string;
  /** Larghezza della colonna (classi di CrewPositionTable.module.css). */
  readonly width: 'laps' | 'gap';
}

/** Controlli di una tabella per posizione, calcolati dalla bozza della gara. */
export interface CrewPositionCheck {
  /** Posizione ripetuta → prima posizione dello stesso equipaggio. */
  readonly repeatedPositions: ReadonlyMap<number, number>;
  /** Vettura che resta legata alla gara per ogni posizione. */
  readonly carIdByPosition: ReadonlyMap<number, number | null>;
  readonly positionsWithoutCar: readonly number[];
}

/** Testi della riga che cambiano da tabella a tabella. */
export interface CrewPositionTexts {
  readonly crewForPosition: (position: number) => string;
  readonly clearPosition: (position: number) => string;
}

interface CrewPositionTableProps {
  readonly positionCount: number;
  readonly crewsQuery: ServerQueryState<SavedCrew[]>;
  readonly championship: string;
  readonly isReadOnly: boolean;
  /** Spiegazione sopra la tabella, solo in modifica. */
  readonly description: string;
  readonly tableLabel?: string;
  readonly crewIdAt: (position: number) => number | null;
  readonly check: CrewPositionCheck;
  readonly texts: CrewPositionTexts;
  readonly onSelectCrew: (position: number, crewId: number | null) => void;
  readonly onClearPosition: (position: number) => void;
  /** Colonne dei valori della riga (giri e distacco, tempi Q1 e Q2). */
  readonly valueColumns: readonly CrewPositionColumn[];
  /** Una cella per colonna di valori; crewId null = riga senza equipaggio. */
  readonly renderValues: (position: number, crewId: number | null) => readonly ReactNode[];
  /** Avvisi sotto la tabella (errori dei valori). */
  readonly footer?: ReactNode;
}

const WIDTH_CLASS: Record<CrewPositionColumn['width'], string | undefined> = { laps: styles.lapsColumn, gap: styles.gapColumn };

/**
 * Tabella per posizione del dettaglio gara (ordine di arrivo, qualifiche): una riga per posizione con l'equipaggio,
 * scelto solo tra quelli del campionato, la vettura della riga, le colonne dei valori e la X che svuota la riga. Un
 * equipaggio già inserito più in alto è segnato in rosso con il rimando alla prima posizione.
 */
export function CrewPositionTable({
  positionCount,
  crewsQuery,
  championship,
  isReadOnly,
  description,
  tableLabel,
  crewIdAt,
  check,
  texts,
  onSelectCrew,
  onClearPosition,
  valueColumns,
  renderValues,
  footer,
}: CrewPositionTableProps) {
  const { messages } = useI18n();
  const formTexts = messages.races.form;
  const errorIdPrefix = useId();
  const { carNameById } = useCarCatalog();

  const notice = crewsQueryNotice(crewsQuery, messages);
  if (notice !== null || crewsQuery.status !== 'loaded') return <p className={styles.notice}>{notice}</p>;

  const allCrews = crewsQuery.value;
  const championshipCrews = findChampionshipCrews(allCrews, championship);
  const crewById = new Map(allCrews.map((crew) => [crew.id, crew]));
  /** Auto attuale dell'equipaggio nel campionato della gara. */
  const currentCarIdOf = (crewId: number) => {
    const crew = crewById.get(crewId);
    return crew && championship !== '' ? crewCarIn(crew, championship) : null;
  };
  const positions = Array.from({ length: positionCount }, (_, index) => index + 1);

  return (
    <div className={styles.raceResults}>
      {!isReadOnly && <p className={styles.notice}>{description}</p>}
      {!isReadOnly && championship === '' && <p className={styles.notice}>{formTexts.chooseChampionshipFirst}</p>}
      {!isReadOnly && championship !== '' && championshipCrews.length === 0 && <p className={styles.notice}>{formTexts.noCrewsInChampionship}</p>}
      <table className={styles.resultsTable} aria-label={tableLabel}>
        <thead>
          <tr>
            <th scope="col" className={styles.positionColumn}>
              {formTexts.positionColumn}
            </th>
            <th scope="col">{formTexts.crewColumn}</th>
            <th scope="col" className={styles.carColumn}>
              {formTexts.carColumn}
            </th>
            {valueColumns.map((column) => (
              <th key={column.header} scope="col" className={WIDTH_CLASS[column.width]}>
                {column.header}
              </th>
            ))}
            {!isReadOnly && (
              <th scope="col" className={styles.clearColumn}>
                <span className={styles.visuallyHidden}>{formTexts.clearColumn}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {positions.map((position) => {
            const crewId = crewIdAt(position);
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
                      onSelectCrew(position, selectedCrewId);
                    }}
                    label={texts.crewForPosition(position)}
                    placeholder={isReadOnly ? '–' : formTexts.crewPlaceholder}
                    clearLabel={formTexts.noCrew}
                    disabled={isReadOnly || championship === ''}
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
                {renderValues(position, crewId).map((cell, index) => (
                  <td key={valueColumns[index]?.header ?? index} className={styles.lapsCell}>
                    {cell}
                  </td>
                ))}
                {!isReadOnly && (
                  <td className={styles.clearCell}>
                    <IconButton
                      accessibleLabel={texts.clearPosition(position)}
                      title={texts.clearPosition(position)}
                      className={styles.clearButton}
                      disabled={crewId === null}
                      onClick={() => {
                        onClearPosition(position);
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
      {footer}
    </div>
  );
}

interface CrewPositionNoticeProps {
  /** error = blocca il salvataggio; info = solo un'indicazione. */
  readonly tone: 'error' | 'info';
  readonly children: string;
}

/** Avviso sotto una tabella per posizione (nel footer). */
export function CrewPositionNotice({ tone, children }: CrewPositionNoticeProps) {
  return tone === 'error' ? (
    <p className={styles.errorNotice} role="alert">
      {children}
    </p>
  ) : (
    <p className={styles.notice} role="status">
      {children}
    </p>
  );
}
