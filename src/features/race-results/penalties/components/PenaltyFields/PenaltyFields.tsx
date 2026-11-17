import type { SavedCrew } from '@shared/crewRules';
import {
  isPenaltyDecision,
  isReprimandGridPenalty,
  PENALTY_DECISIONS,
  PENALTY_DOCUMENTS,
  PENALTY_REASON_MAX_LENGTH,
  PENALTY_VIOLATION_MAX_LENGTH,
  reprimandCycleNumber,
} from '@shared/penaltyRules';
import { useId } from 'react';
import { FormField } from '@/components/form/FormField/FormField';
import { ColorDot } from '@/components/ui/ColorDot/ColorDot';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { useI18n } from '@/i18n/useI18n';
import type { PenaltyDraftState } from '../../hooks/usePenaltyDraft';
import { CrewMultiPicker } from '../CrewMultiPicker/CrewMultiPicker';
import styles from './PenaltyFields.module.css';

/** Valore del menu per "nessuna decisione" (il menu nativo vuole un valore per ogni voce). */
const NO_DECISION = 'none';

interface PenaltyFieldsProps {
  readonly draft: PenaltyDraftState;
  /** Vetture del campionato della gara, per numero. */
  readonly crews: readonly SavedCrew[];
  readonly isReadOnly: boolean;
  /** Reprimende di ogni vettura già date prima di questa penalità (per mostrare 1ª, 2ª o 3ª); senza, non si mostra. */
  readonly reprimandCountsBefore?: ReadonlyMap<number, number> | undefined;
  /** Vetture già decise (es. quelle di una protesta): l'elenco non si cambia, solo le decisioni. */
  readonly areCrewsFixed?: boolean;
  /** Suggerimenti al posto di quelli delle penalità della gara (es. motivazione obbligatoria). */
  readonly crewsHint?: string;
  readonly reasonHint?: string;
}

/**
 * Vetture coinvolte; poi, per ognuna, la sua Decisione (facoltativa); quindi Violazione e Motivazione.
 * Usati sia in "Nuova penalità" sia nel dettaglio.
 */
export function PenaltyFields({ draft, crews, isReadOnly, reprimandCountsBefore, areCrewsFixed = false, crewsHint, reasonHint }: PenaltyFieldsProps) {
  const { messages } = useI18n();
  const texts = messages.penalties.form;
  const decisionsHeadingId = useId();
  const { values, check } = draft;
  const decisionByCrewId = new Map(values.crews.map((crew) => [crew.crewId, crew.decision]));
  const involvedCrews = crews.filter((crew) => decisionByCrewId.has(crew.id));
  /** Con una reprimenda: quale sarebbe nel ciclo della vettura e, alla terza, la penalità automatica in griglia. */
  const reprimandNote = (crewId: number) => {
    if (decisionByCrewId.get(crewId) !== 'reprimand' || !reprimandCountsBefore) return null;
    const cycleNumber = reprimandCycleNumber((reprimandCountsBefore.get(crewId) ?? 0) + 1);
    const isGridPenalty = isReprimandGridPenalty(cycleNumber);
    return { text: isGridPenalty ? texts.reprimandGridPenalty : texts.reprimandCount(cycleNumber), isGridPenalty };
  };
  const decisionOptions = [
    { value: NO_DECISION, label: texts.noDecision },
    ...PENALTY_DECISIONS.map((decision) => ({ value: decision, label: messages.penalties.decisions[decision] })),
  ];

  return (
    <div className={styles.penaltyFields}>
      <FormField label={texts.crews} hint={isReadOnly ? undefined : (crewsHint ?? texts.crewsHint)}>
        {(controlProps) => (
          <CrewMultiPicker
            id={controlProps.id}
            aria-describedby={controlProps['aria-describedby']}
            crews={crews}
            selectedCrewIds={values.crews.map((crew) => crew.crewId)}
            onToggleCrew={draft.toggleCrew}
            listLabel={texts.crews}
            placeholder={texts.crewsPlaceholder}
            crewOptionLabel={(crew) => texts.crewOption(crew.number, crew.name)}
            disabled={isReadOnly || areCrewsFixed}
          />
        )}
      </FormField>

      {involvedCrews.length > 0 && (
        <section className={styles.decisions} aria-labelledby={decisionsHeadingId}>
          <div className={styles.decisionsHeader}>
            <h3 id={decisionsHeadingId} className={styles.decisionsTitle}>
              {texts.decisions}
            </h3>
            {!isReadOnly && <p className={styles.hint}>{texts.decisionsHint}</p>}
          </div>
          <ul className={styles.decisionList}>
            {involvedCrews.map((crew) => {
              const note = reprimandNote(crew.id);
              return (
                <li key={crew.id} className={styles.decisionRow}>
                  <span className={styles.crew}>
                    <ColorDot color={crew.color} size="small" />
                    <span className={styles.crewNumber}>#{crew.number}</span>
                    <span className={styles.crewName}>{crew.name}</span>
                  </span>
                  <div className={styles.decisionControl}>
                    <Select
                      aria-label={texts.decisionFor(crew.number)}
                      disabled={isReadOnly}
                      value={decisionByCrewId.get(crew.id) ?? NO_DECISION}
                      options={decisionOptions}
                      onValueChange={(decision) => {
                        draft.changeCrewDecision(crew.id, isPenaltyDecision(decision) ? decision : null);
                      }}
                    />
                    {note && (
                      <p className={styles.reprimandNote} data-grid-penalty={note.isGridPenalty || undefined}>
                        {note.text}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Violazione (numero dell'articolo) e documento: nel referto "Violazione dell'art. 2.4 del C.d.C." */}
      <div className={styles.violationRow}>
        <FormField
          label={texts.violation}
          hint={isReadOnly ? undefined : texts.violationHint}
          errorMessage={
            isReadOnly
              ? undefined
              : check.isViolationTooLong
                ? texts.violationTooLong(PENALTY_VIOLATION_MAX_LENGTH)
                : check.isViolationInvalid
                  ? texts.violationInvalid
                  : undefined
          }
        >
          {({ isInvalid, ...inputAttributes }) => (
            <Input
              {...inputAttributes}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              maxLength={PENALTY_VIOLATION_MAX_LENGTH}
              readOnly={isReadOnly}
              isInvalid={isInvalid}
              value={values.violation}
              onValueChange={draft.changeViolation}
            />
          )}
        </FormField>
        <FormField label={texts.document}>
          {(controlProps) => (
            <Select
              id={controlProps.id}
              aria-describedby={controlProps['aria-describedby']}
              value={values.document}
              placeholderLabel={texts.documentPlaceholder}
              options={PENALTY_DOCUMENTS.map((document) => ({ value: document, label: messages.penalties.documents[document] }))}
              disabled={isReadOnly}
              onValueChange={draft.changeDocument}
            />
          )}
        </FormField>
      </div>

      <FormField
        label={texts.reason}
        hint={isReadOnly ? undefined : (reasonHint ?? texts.reasonHint)}
        errorMessage={!isReadOnly && check.isReasonTooLong ? texts.reasonTooLong(PENALTY_REASON_MAX_LENGTH) : undefined}
      >
        {({ isInvalid, ...textareaAttributes }) => (
          <Textarea
            {...textareaAttributes}
            rows={5}
            maxLength={PENALTY_REASON_MAX_LENGTH}
            readOnly={isReadOnly}
            isInvalid={isInvalid}
            value={values.reason}
            onValueChange={draft.changeReason}
          />
        )}
      </FormField>
    </div>
  );
}
