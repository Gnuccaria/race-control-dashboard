import { CREW_CHAMPIONSHIP_CHOICES, CREW_NAME_MAX_LENGTH, type CrewNameIssue, NO_CHAMPIONSHIP } from '@shared/crewRules';
import { FormField } from '@/components/form/FormField/FormField';
import { ColorField } from '@/components/ui/ColorField/ColorField';
import { useCarCatalog } from '@/features/cars/useCarCatalog';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import type { ValidationMessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/useI18n';
import { CREW_FORM_FIELDS } from '../../crewFormFields';
import type { CrewDraftState } from '../../hooks/useCrewDraft';
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

/** Nome, numero, auto, campionato e colore: usati sia in "Aggiungi equipaggio" sia nel dettaglio. */
export function CrewFields({ draft, isReadOnly = false }: CrewFieldsProps) {
  const { messages } = useI18n();
  const crewTexts = messages.crews;
  const { values } = draft;
  // Le auto arrivano dal server: lette all'apertura e di nuovo a ogni interazione con il menu.
  const carCatalog = useCarCatalog();
  const carOptions = carCatalog.cars.map((car) => ({ value: String(car.id), label: carCatalog.carNameById.get(car.id) ?? '' }));
  const selectedCarIsMissing = values.carId !== '' && !carCatalog.isLoading && !carCatalog.carNameById.has(Number(values.carId));
  const carPlaceholder = carCatalog.isLoading
    ? messages.cars.loading
    : selectedCarIsMissing
      ? messages.cars.unknownCar
      : isReadOnly
        ? crewTexts.missingCar
        : crewTexts.carPlaceholder;

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

        <FormField
          label={crewTexts.car}
          errorMessage={carCatalog.errorKind && !isReadOnly ? messages.serverErrors[carCatalog.errorKind] : undefined}
        >
          {(controlProps) => (
            <Select
              id={controlProps.id}
              aria-describedby={controlProps['aria-describedby']}
              name={CREW_FORM_FIELDS.carId}
              disabled={isReadOnly}
              placeholderLabel={carPlaceholder}
              value={carCatalog.isLoading || selectedCarIsMissing ? '' : values.carId}
              options={carOptions}
              onValueChange={draft.changeCar}
              onFocus={carCatalog.refresh}
            />
          )}
        </FormField>
      </div>

      <FormField label={crewTexts.championship}>
        {(controlProps) => (
          <Select
            id={controlProps.id}
            aria-describedby={controlProps['aria-describedby']}
            name={CREW_FORM_FIELDS.championship}
            disabled={isReadOnly}
            placeholderLabel={isReadOnly ? crewTexts.missingChampionship : crewTexts.championshipPlaceholder}
            value={values.championship}
            // "Nessuno" per gli equipaggi che non partecipano a nessun campionato.
            options={CREW_CHAMPIONSHIP_CHOICES.map((championship) => ({
              value: championship,
              label: championship === NO_CHAMPIONSHIP ? messages.crews.noChampionship : championship,
            }))}
            onValueChange={draft.changeChampionship}
          />
        )}
      </FormField>

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
    </div>
  );
}
