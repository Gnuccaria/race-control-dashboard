import { CREW_NAME_MAX_LENGTH, type CrewNameIssue } from '@shared/crewRules';
import { FormField } from '@/components/form/FormField/FormField';
import { ColorField } from '@/components/ui/ColorField/ColorField';
import { Input } from '@/components/ui/Input/Input';
import type { ValidationMessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/useI18n';
import { CREW_FORM_FIELDS } from '../../crewFormFields';
import type { CrewDraftState } from '../../hooks/useCrewDraft';
import { CrewChampionshipsField } from '../CrewChampionshipsField/CrewChampionshipsField';
import styles from './CrewFields.module.css';


const NAME_ISSUE_MESSAGE_KEYS: Record<Exclude<CrewNameIssue, 'required'>, ValidationMessageKey> = {
  'invalid-characters': 'crewNameInvalidCharacters',
  'too-long': 'crewNameTooLong',
};

interface CrewFieldsProps {
  readonly draft: CrewDraftState;
  /** Sola lettura: i dati si vedono negli stessi campi, ma non si possono cambiare. */
  readonly isReadOnly?: boolean;
}

/** Nome, numero, campionati (ognuno con la sua auto), colore e Discord: usati sia in "Aggiungi equipaggio" sia nel dettaglio. */
export function CrewFields({ draft, isReadOnly = false }: CrewFieldsProps) {
  const { messages } = useI18n();
  const crewTexts = messages.crews;
  const { values } = draft;

  const nameError =
    !isReadOnly && draft.visibleNameIssue ? messages.validation[NAME_ISSUE_MESSAGE_KEYS[draft.visibleNameIssue]] : undefined;

  return (
    <div className={styles.crewFields}>
      <FormField label={crewTexts.crewName} hint={isReadOnly ? undefined : crewTexts.crewNameHint} errorMessage={nameError}>
        {({ isInvalid, ...inputAttributes }) => (
          <Input
            {...inputAttributes}
            type="text"
            name={CREW_FORM_FIELDS.name}
            maxLength={CREW_NAME_MAX_LENGTH}
            spellCheck={false}
            readOnly={isReadOnly}
            isInvalid={isInvalid}
            value={values.name}
            onValueChange={draft.changeName}
          />
        )}
      </FormField>

      <div className={styles.fieldPair}>
        <FormField label={crewTexts.crewNumber} hint={isReadOnly ? undefined : crewTexts.crewNumberHint}>
          {({ isInvalid, ...inputAttributes }) => (
            <Input
              {...inputAttributes}
              type="text"
              name={CREW_FORM_FIELDS.number}
              inputMode="numeric"
              maxLength={3}
              readOnly={isReadOnly}
              isInvalid={isInvalid}
              value={values.numberText}
              onValueChange={draft.changeNumber}
            />
          )}
        </FormField>
      </div>

      <CrewChampionshipsField draft={draft} isReadOnly={isReadOnly} />

      <FormField label={crewTexts.color} hint={isReadOnly ? undefined : crewTexts.colorHint}>
        {(controlProps) => (
          <ColorField
            id={controlProps.id}
            aria-describedby={controlProps['aria-describedby']}
            name={CREW_FORM_FIELDS.color}
            disabled={isReadOnly}
            isRemovable={false}
            value={values.color}
            onValueChange={draft.changeColor}
          />
        )}
      </FormField>

      <FormField
        label={crewTexts.discordChannel}
        hint={isReadOnly ? undefined : crewTexts.discordChannelHint}
        errorMessage={!isReadOnly && draft.isChannelInvalid ? crewTexts.discordChannelInvalid : undefined}
      >
        {({ isInvalid, ...inputAttributes }) => (
          <Input
            {...inputAttributes}
            type="text"
            name={CREW_FORM_FIELDS.discordChannelId}
            inputMode="numeric"
            maxLength={120}
            spellCheck={false}
            autoComplete="off"
            readOnly={isReadOnly}
            placeholder={isReadOnly ? crewTexts.noDiscordChannel : undefined}
            isInvalid={isInvalid}
            value={values.discordChannelId}
            onValueChange={draft.changeDiscordChannel}
            onBlur={draft.normalizeDiscordChannel}
          />
        )}
      </FormField>

      <FormField
        label={crewTexts.discordRole}
        hint={isReadOnly ? undefined : crewTexts.discordRoleHint}
        errorMessage={!isReadOnly && draft.isRoleInvalid ? crewTexts.discordRoleInvalid : undefined}
      >
        {({ isInvalid, ...inputAttributes }) => (
          <Input
            {...inputAttributes}
            type="text"
            name={CREW_FORM_FIELDS.discordRoleId}
            inputMode="numeric"
            maxLength={40}
            spellCheck={false}
            autoComplete="off"
            readOnly={isReadOnly}
            placeholder={isReadOnly ? crewTexts.noDiscordRole : undefined}
            isInvalid={isInvalid}
            value={values.discordRoleId}
            onValueChange={draft.changeDiscordRole}
            onBlur={draft.normalizeDiscordRole}
          />
        )}
      </FormField>
    </div>
  );
}
