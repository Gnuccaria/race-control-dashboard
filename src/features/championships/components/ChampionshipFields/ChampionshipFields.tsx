import { CHAMPIONSHIP_NAME_MAX_LENGTH } from '@shared/championshipRules';
import { FormField } from '@/components/form/FormField/FormField';
import { Input } from '@/components/ui/Input/Input';
import { useI18n } from '@/i18n/useI18n';
import type { ChampionshipDraftState } from '../../hooks/useChampionshipDraft';
import { ChampionshipCarsField } from '../ChampionshipCarsField/ChampionshipCarsField';
import { ChampionshipDurationsField } from '../ChampionshipDurationsField/ChampionshipDurationsField';
import styles from './ChampionshipFields.module.css';

interface ChampionshipFieldsProps {
  readonly draft: ChampionshipDraftState;
  readonly isReadOnly?: boolean;
  /** Vetture usate da almeno un equipaggio del campionato (solo nel dettaglio): non si possono togliere. */
  readonly lockedCarIds?: readonly number[];
}

/** Nome, durate (con lo stint) e vetture ammesse: in "Crea campionato" e nel dettaglio. */
export function ChampionshipFields({ draft, isReadOnly = false, lockedCarIds = [] }: ChampionshipFieldsProps) {
  const { messages } = useI18n();
  const texts = messages.championships;
  const nameError = !isReadOnly && draft.visibleNameIssue && draft.visibleNameIssue !== 'required' ? texts.nameIssues[draft.visibleNameIssue] : undefined;

  return (
    <div className={styles.fields}>
      <FormField label={texts.name} hint={isReadOnly ? undefined : texts.nameHint} errorMessage={nameError}>
        {({ isInvalid, ...inputAttributes }) => (
          <Input
            {...inputAttributes}
            type="text"
            maxLength={CHAMPIONSHIP_NAME_MAX_LENGTH}
            spellCheck={false}
            readOnly={isReadOnly}
            isInvalid={isInvalid}
            value={draft.values.name}
            onValueChange={draft.changeName}
          />
        )}
      </FormField>
      <ChampionshipDurationsField draft={draft} isReadOnly={isReadOnly} />
      <ChampionshipCarsField draft={draft} isReadOnly={isReadOnly} lockedCarIds={lockedCarIds} />
    </div>
  );
}
