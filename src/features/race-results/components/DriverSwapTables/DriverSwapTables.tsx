import type { SavedCrew } from '@shared/crewRules';
import { DRIVER_SWAP_NOTES_MAX_LENGTH, formatRaceTimestamp } from '@shared/driverSwapRules';
import { useId, useState } from 'react';
import { FormField } from '@/components/form/FormField/FormField';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import type { ServerQueryState } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { joinClassNames } from '@/lib/joinClassNames';
import type { RaceDraftState } from '../../hooks/useRaceDraft';
import { EMPTY_DRIVER_SWAP_ROW, getDriverSwapRow, invalidCellKey } from '../../model/driverSwapDraft';
import styles from './DriverSwapTables.module.css';
import { serverErrorText } from '@/services/serverErrorText';

const TIME_PLACEHOLDER = 'HH:MM:SS.DDD';

interface DriverSwapTablesProps {
  readonly draft: RaceDraftState;
  readonly crewsQuery: ServerQueryState<SavedCrew[]>;
  readonly isReadOnly: boolean;
}

/**
 * Scheda "Cambi pilota": il foglio "Driver Swap Checker" con i tempi scritti direttamente nelle tabelle.
 * Il campionato decide quanti cambi ci sono; con più di uno, un menu sopra la tabella sceglie quale mostrare.
 * Sopra, il totale delle penalità per vettura.
 */
export function DriverSwapTables({ draft, crewsQuery, isReadOnly }: DriverSwapTablesProps) {
  const { messages } = useI18n();
  const texts = messages.races.driverSwaps;
  const formTexts = messages.races.form;
  const headingIdPrefix = useId();
  const [selectedSwapIndex, setSelectedSwapIndex] = useState(0);
  const { values, championshipCrews, swapCount, driverSwapSheet } = draft;

  if (crewsQuery.status === 'loading') return <p className={styles.notice}>{formTexts.loadingCrews}</p>;
  if (crewsQuery.status === 'failed') return <p className={styles.notice}>{serverErrorText(messages, crewsQuery.errorKind)}</p>;
  if (values.championship === '') return <p className={styles.notice}>{texts.noChampionship}</p>;
  if (championshipCrews.length === 0) return <p className={styles.notice}>{formTexts.noCrewsInChampionship}</p>;

  // Cambiando campionato i cambi possono diminuire: si torna al primo.
  const swapIndex = selectedSwapIndex < swapCount ? selectedSwapIndex : 0;
  const fromStint = swapIndex + 1;
  const toStint = swapIndex + 2;
  const formatTime = (milliseconds: number | null) =>
    milliseconds === null ? <span className={styles.missing}>–</span> : formatRaceTimestamp(milliseconds);
  const crewById = new Map(championshipCrews.map((crew) => [crew.id, crew]));
  const checks = driverSwapSheet.checksBySwap[swapIndex];
  const invalidCount = driverSwapSheet.invalidCells.size;
  const tableHeadingId = `${headingIdPrefix}-swap`;

  return (
    <div className={styles.driverSwaps}>
      <p className={styles.notice}>{isReadOnly ? texts.readOnlyDescription : texts.description}</p>

      {/* Somma per vettura delle penalità non annullate di tutti i cambi. */}
      <section className={styles.summary} aria-labelledby={`${headingIdPrefix}-summary`}>
        <h3 id={`${headingIdPrefix}-summary`} className={styles.tableTitle}>
          {texts.summaryTitle}
        </h3>
        {driverSwapSheet.totals.length === 0 ? (
          <p className={styles.emptySummary}>{texts.noPenalties}</p>
        ) : (
          <table className={joinClassNames(styles.swapTable, styles.summaryTable)} aria-labelledby={`${headingIdPrefix}-summary`}>
            <thead>
              <tr>
                <th scope="col">{texts.columns.number}</th>
                <th scope="col" className={styles.numeric}>
                  {texts.columns.totalPenalty}
                </th>
              </tr>
            </thead>
            <tbody>
              {driverSwapSheet.totals.map((total) => (
                <tr key={total.crewId}>
                  <td className={styles.numberCell}>#{crewById.get(total.crewId)?.number ?? '?'}</td>
                  <td className={joinClassNames(styles.numeric, styles.penaltyValue)}>{formatRaceTimestamp(total.penaltyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {!isReadOnly && invalidCount > 0 && (
        <p className={styles.errorMessage} role="alert">
          {texts.invalidTimes(invalidCount)}
        </p>
      )}

      <section className={styles.swapSection} aria-labelledby={tableHeadingId}>
        {swapCount > 1 && (
          <div className={styles.swapPicker}>
            <FormField label={texts.swapPicker}>
              {(controlProps) => (
                <Select
                  id={controlProps.id}
                  aria-describedby={controlProps['aria-describedby']}
                  value={String(swapIndex)}
                  options={Array.from({ length: swapCount }, (_unused, index) => ({
                    value: String(index),
                    label:
                      texts.swapOption(index + 1, index + 2) +
                      (!isReadOnly && driverSwapSheet.swapsWithErrors.has(index) ? ` (${texts.optionHasErrors})` : ''),
                  }))}
                  onValueChange={(indexText) => {
                    setSelectedSwapIndex(Number(indexText));
                  }}
                />
              )}
            </FormField>
          </div>
        )}
        <h3 id={tableHeadingId} className={styles.tableTitle}>
          {texts.swapTitle(swapIndex + 1, fromStint, toStint)}
        </h3>
        <div className={styles.tableScroller}>
          <table className={styles.swapTable} aria-labelledby={tableHeadingId}>
            <thead>
              <tr>
                <th scope="col" className={styles.numberColumn}>
                  {texts.columns.number}
                </th>
                <th scope="col" className={styles.timeColumn}>
                  {texts.columns.pitIn(fromStint)}
                </th>
                <th scope="col" className={joinClassNames(styles.diffColumn, styles.numeric)}>
                  {texts.columns.pitInDiff}
                </th>
                <th scope="col" className={styles.timeColumn}>
                  {texts.columns.pitOut(toStint)}
                </th>
                <th scope="col" className={joinClassNames(styles.diffColumn, styles.numeric)}>
                  {texts.columns.pitOutDiff}
                </th>
                <th scope="col">{texts.columns.result}</th>
                <th scope="col" className={joinClassNames(styles.diffColumn, styles.numeric)}>
                  {texts.columns.penalty}
                </th>
                <th scope="col" className={styles.cancelledColumn}>
                  {texts.columns.cancelled}
                </th>
                <th scope="col">{texts.columns.notes}</th>
                {!isReadOnly && <td className={styles.clearColumn} />}
              </tr>
            </thead>
            <tbody>
              {championshipCrews.map((crew) => {
                const row = getDriverSwapRow(values.driverSwap, swapIndex, crew.id);
                const check = checks?.get(crew.id);
                const change = (rowChange: Parameters<typeof draft.changeDriverSwapRow>[2]) => {
                  draft.changeDriverSwapRow(swapIndex, crew.id, rowChange);
                };
                return (
                  <tr key={crew.id} data-penalty={check?.isPenalty || undefined} data-cancelled={(check?.isPenalty && row.isCancelled) || undefined}>
                    <td className={styles.numberCell}>#{crew.number}</td>
                    <td>
                      <Input
                        type="text"
                        inputMode="decimal"
                        maxLength={14}
                        placeholder={isReadOnly ? undefined : TIME_PLACEHOLDER}
                        aria-label={texts.pitInFor(crew.number, fromStint)}
                        readOnly={isReadOnly}
                        isInvalid={driverSwapSheet.invalidCells.has(invalidCellKey(swapIndex, crew.id, 'pitIn'))}
                        value={row.pitInText}
                        onValueChange={(pitInText) => {
                          change({ pitInText });
                        }}
                        onBlur={() => {
                          draft.formatDriverSwapTime(swapIndex, crew.id, 'pitIn');
                        }}
                      />
                    </td>
                    <td className={styles.numeric}>{formatTime(check?.pitInDiffMs ?? null)}</td>
                    <td>
                      <Input
                        type="text"
                        inputMode="decimal"
                        maxLength={14}
                        placeholder={isReadOnly ? undefined : TIME_PLACEHOLDER}
                        aria-label={texts.pitOutFor(crew.number, toStint)}
                        readOnly={isReadOnly}
                        isInvalid={driverSwapSheet.invalidCells.has(invalidCellKey(swapIndex, crew.id, 'pitOut'))}
                        value={row.pitOutText}
                        onValueChange={(pitOutText) => {
                          change({ pitOutText });
                        }}
                        onBlur={() => {
                          draft.formatDriverSwapTime(swapIndex, crew.id, 'pitOut');
                        }}
                      />
                    </td>
                    <td className={styles.numeric}>{formatTime(check?.pitOutDiffMs ?? null)}</td>
                    <td>{check?.isPenalty ? <span className={styles.penaltyFlag}>{texts.penaltyFlag}</span> : null}</td>
                    <td className={joinClassNames(styles.numeric, styles.penaltyValue)}>{formatTime(check?.penaltyMs ?? null)}</td>
                    <td className={styles.cancelledCell}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        aria-label={texts.cancelledFor(crew.number, swapIndex + 1)}
                        checked={row.isCancelled}
                        disabled={isReadOnly}
                        onChange={(changeEvent) => {
                          change({ isCancelled: changeEvent.currentTarget.checked });
                        }}
                      />
                    </td>
                    <td className={styles.notesCell}>
                      <Input
                        type="text"
                        maxLength={DRIVER_SWAP_NOTES_MAX_LENGTH}
                        aria-label={texts.notesFor(crew.number, swapIndex + 1)}
                        readOnly={isReadOnly}
                        value={row.notes}
                        onValueChange={(notes) => {
                          change({ notes });
                        }}
                      />
                    </td>
                    {/* La X svuota la riga: tempi, annullata e note (visibile solo in modifica). */}
                    {!isReadOnly && (
                      <td className={styles.clearColumn}>
                        <IconButton
                          accessibleLabel={texts.clearRowFor(crew.number, swapIndex + 1)}
                          title={texts.clearRowFor(crew.number, swapIndex + 1)}
                          className={styles.clearButton}
                          disabled={row.pitInText === '' && row.pitOutText === '' && !row.isCancelled && row.notes === ''}
                          onClick={() => {
                            change({ ...EMPTY_DRIVER_SWAP_ROW });
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
        </div>
      </section>
    </div>
  );
}
