import type { SavedCrew } from '@shared/crewRules';
import { RACE_NAME_MAX_LENGTH } from '@shared/raceRules';
import { FormField } from '@/components/form/FormField/FormField';
import { TimeField } from '@/components/form/TimeField/TimeField';
import { Input } from '@/components/ui/Input/Input';
import { Select } from '@/components/ui/Select/Select';
import { TrackField } from '@/features/tracks/components/TrackField/TrackField';
import { useTrackCatalog } from '@/features/tracks/useTrackCatalog';
import { useI18n } from '@/i18n/useI18n';
import type { RaceDraftState } from '../../hooks/useRaceDraft';
import styles from './RaceInfoFields.module.css';

interface RaceInfoFieldsProps {
  readonly draft: RaceDraftState;
  /** Tutti gli equipaggi: servono per togliere dalla classifica quelli di un altro campionato. */
  readonly allCrews: readonly SavedCrew[];
  readonly isReadOnly: boolean;
}

/**
 * Scheda "Anagrafica": nome della gara, campionato (con la durata dove serve), round, data e tracciato
 * (scelto nel popup Nazione → Tracciato → Configurazione).
 */
export function RaceInfoFields({ draft, allCrews, isReadOnly }: RaceInfoFieldsProps) {
  const { messages } = useI18n();
  const formTexts = messages.races.form;
  const { values, check } = draft;
  const trackCatalog = useTrackCatalog();
  // Tutti i campionati creati; quello della gara resta nel menu anche mentre l'elenco si legge.
  const championshipNames = draft.championshipCatalog.championships.map(({ name }) => name);
  if (values.championship !== '' && !championshipNames.includes(values.championship)) championshipNames.push(values.championship);
  // Solo le durate del campionato scelto; con una sola durata si sceglie da sola.
  const durationOptions = draft.durationOptions.map((hours) => ({ value: String(hours), label: formTexts.durationLabel(hours) }));
  if (values.duration !== '' && !draft.durationOptions.includes(Number(values.duration))) {
    durationOptions.push({ value: values.duration, label: formTexts.durationLabel(Number(values.duration)) });
  }

  return (
    <div className={styles.raceInfoFields}>
      <FormField
        label={formTexts.name}
        hint={isReadOnly ? undefined : formTexts.nameHint}
        errorMessage={!isReadOnly && check.isNameInvalid ? formTexts.nameInvalid : undefined}
      >
        {({ isInvalid, ...inputAttributes }) => (
          <Input
            {...inputAttributes}
            type="text"
            maxLength={RACE_NAME_MAX_LENGTH}
            readOnly={isReadOnly}
            isInvalid={isInvalid}
            value={values.name}
            onValueChange={draft.changeName}
          />
        )}
      </FormField>

      {/* Durata accanto al campionato: le sue voci sono le durate del campionato scelto. */}
      <div className={styles.fieldPair}>
        <FormField label={formTexts.championship}>
          {(controlProps) => (
            <Select
              id={controlProps.id}
              aria-describedby={controlProps['aria-describedby']}
              disabled={isReadOnly}
              placeholderLabel={formTexts.championshipPlaceholder}
              value={values.championship}
              options={championshipNames.map((name) => ({ value: name, label: name }))}
              onValueChange={(championship) => {
                draft.changeChampionship(championship, allCrews);
              }}
              onFocus={draft.championshipCatalog.refresh}
            />
          )}
        </FormField>

        <FormField label={formTexts.duration} hint={isReadOnly || check.isDurationRequired ? undefined : formTexts.durationHint}>
          {(controlProps) => (
            <Select
              id={controlProps.id}
              aria-describedby={controlProps['aria-describedby']}
              disabled={isReadOnly || !check.isDurationRequired}
              placeholderLabel={formTexts.durationPlaceholder}
              value={values.duration}
              options={durationOptions}
              onValueChange={draft.changeDuration}
            />
          )}
        </FormField>
      </div>

      <div className={styles.fieldPair}>
        <FormField
          label={formTexts.round}
          hint={isReadOnly ? undefined : formTexts.roundHint}
          errorMessage={!isReadOnly && check.isRoundInvalid ? formTexts.roundInvalid : undefined}
        >
          {({ isInvalid, ...inputAttributes }) => (
            <Input
              {...inputAttributes}
              type="text"
              inputMode="numeric"
              maxLength={2}
              readOnly={isReadOnly}
              isInvalid={isInvalid}
              value={values.roundText}
              onValueChange={draft.changeRound}
            />
          )}
        </FormField>

        <FormField label={formTexts.raceDate} hint={isReadOnly ? undefined : formTexts.raceDateHint}>
          {({ isInvalid, ...inputAttributes }) => (
            <Input {...inputAttributes} type="date" readOnly={isReadOnly} isInvalid={isInvalid} value={values.raceDate} onValueChange={draft.changeRaceDate} />
          )}
        </FormField>
      </div>

      {/* Orari in ora italiana: da qui la finestra delle proteste (dall'inizio a 48 ore dopo la fine). */}
      <div className={styles.fieldPair}>
        {/* Orari con i menu di ore e minuti (AM/PM solo in inglese), non con il campo del sistema operativo. */}
        <TimeField
          label={formTexts.startTime}
          hint={isReadOnly ? undefined : formTexts.scheduleHint}
          isReadOnly={isReadOnly}
          field={{ value: values.startTime, onValueChange: draft.changeStartTime }}
        />
        <FormField label={formTexts.endDate}>
          {({ isInvalid, ...inputAttributes }) => (
            <Input {...inputAttributes} type="date" min={values.raceDate || undefined} readOnly={isReadOnly} isInvalid={isInvalid} value={values.endDate} onValueChange={draft.changeEndDate} />
          )}
        </FormField>
        <TimeField
          label={formTexts.endTime}
          isReadOnly={isReadOnly}
          field={{
            value: values.endTime,
            onValueChange: draft.changeEndTime,
            errorMessage: !isReadOnly && check.isEndBeforeStart ? formTexts.endBeforeStart : undefined,
          }}
        />
      </div>

      {/* Tracciato e giri totali, facoltativi entrambi. */}
      <div className={styles.fieldPair}>
        <FormField label={formTexts.track} hint={isReadOnly ? undefined : formTexts.trackHint}>
          {(controlProps) => (
            <TrackField
              id={controlProps.id}
              aria-describedby={controlProps['aria-describedby']}
              disabled={isReadOnly}
              value={{ trackId: values.trackId, isReversed: values.isTrackReversed }}
              catalog={trackCatalog}
              onValueChange={draft.changeTrack}
            />
          )}
        </FormField>

        <FormField
          label={formTexts.totalLaps}
          hint={isReadOnly ? undefined : formTexts.totalLapsHint}
          errorMessage={!isReadOnly && check.isTotalLapsInvalid ? formTexts.totalLapsInvalid : undefined}
        >
          {({ isInvalid, ...inputAttributes }) => (
            <Input
              {...inputAttributes}
              type="text"
              inputMode="numeric"
              maxLength={3}
              readOnly={isReadOnly}
              isInvalid={isInvalid}
              value={values.totalLapsText}
              onValueChange={draft.changeTotalLaps}
            />
          )}
        </FormField>
      </div>
    </div>
  );
}
