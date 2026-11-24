import { PROTEST_DESCRIPTION_COUNTER_FROM, PROTEST_DESCRIPTION_MAX_LENGTH, PROTEST_LAP_MAX, PROTEST_STINT_MAX } from '@shared/protestRules';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog/ConfirmDialog';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { FormField } from '@/components/form/FormField/FormField';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { Panel } from '@/components/ui/Panel/Panel';
import { Select } from '@/components/ui/Select/Select';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar';
import { Textarea } from '@/components/ui/Textarea/Textarea';
import { CrewMultiPicker } from '@/features/race-results/penalties/components/CrewMultiPicker/CrewMultiPicker';
import { useI18n } from '@/i18n/useI18n';
import { type ProtestFormData, type ProtestRequestProblem, submitProtest, uploadProtestVideo, type VideoUploadProblem } from '../../api/protests';
import { endExpiredSiteSession, getFreshSiteAccessToken } from '../../auth/siteAuthStore';
import { digitsOnly } from '../DisconnectionTicketForm/disconnectionTicketValues';
import { checkProtestForm, EMPTY_PROTEST_VALUES, type ProtestFormValues } from './protestFormValues';
import styles from './ProtestForm.module.css';
import { VideoDropzone } from './VideoDropzone';

/** Equipaggio di chi è entrato e altri equipaggi del campionato, letti dal server. */
export type ProtestFormState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: ProtestFormData }
  | { readonly status: 'problem'; readonly problem: 'no-crew-role' | 'multiple-crew-roles' | 'crew-not-found' | 'bot-unavailable' | 'server-outdated' | 'unavailable' };

interface ProtestFormProps {
  readonly formState: ProtestFormState;
  /** Protesta inviata (videoProblem: perché il video non è stato caricato): la pagina apre il suo dettaglio. */
  readonly onSent: (protestId: number, videoProblem: VideoUploadProblem | null) => void;
}

/**
 * Modulo della protesta: equipaggio (dal ruolo Discord, non modificabile), stint, giro dello stint e curva
 * (obbligatori), altri equipaggi coinvolti, descrizione, video e link YouTube (facoltativi). "Invia protesta"
 * chiede conferma, manda i dati e poi, se c'è, carica il video mostrando l'avanzamento.
 */
export function ProtestForm({ formState, onSent }: ProtestFormProps) {
  const { messages, locale } = useI18n();
  const texts = messages.site.protest.form;
  const crewTexts = messages.site.disconnectionTicket.form;
  const [values, setValues] = useState<ProtestFormValues>(EMPTY_PROTEST_VALUES);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadFraction, setUploadFraction] = useState<number | null>(null);
  const [failure, setFailure] = useState<ProtestRequestProblem | null>(null);
  const races = formState.status === 'ready' ? formState.data.races : [];
  const selectedRace = races.find((race) => String(race.id) === values.raceId);
  // Gara con la finestra delle qualifiche aperta: la protesta è di qualifica e non ha lo stint.
  const isQualifying = selectedRace?.session === 'qualifying';
  const check = checkProtestForm(values, isQualifying);
  const canSend = check.submission !== null && formState.status === 'ready' && !isSending;

  const change = <Field extends keyof ProtestFormValues>(field: Field, value: ProtestFormValues[Field]) => {
    setValues((previousValues) => ({ ...previousValues, [field]: value }));
  };

  const send = async () => {
    setIsConfirmOpen(false);
    if (!check.submission) return;
    setIsSending(true);
    setFailure(null);
    const accessToken = await getFreshSiteAccessToken();
    const result = accessToken ? await submitProtest(accessToken, check.submission) : null;
    if (!result?.isSuccess) {
      const problem = result ? result.problem : 'signed-out';
      if (problem === 'signed-out') endExpiredSiteSession();
      setIsSending(false);
      setFailure(problem);
      return;
    }
    const protestId = result.value;
    let videoProblem: VideoUploadProblem | null = null;
    if (values.video && accessToken) {
      setUploadFraction(0);
      const upload = await uploadProtestVideo(accessToken, protestId, values.video.file, setUploadFraction);
      if (!upload.isSuccess) videoProblem = upload.problem === 'signed-out' ? 'unavailable' : upload.problem;
      setUploadFraction(null);
    }
    setIsSending(false);
    onSent(protestId, videoProblem);
  };

  const crewValue =
    formState.status === 'ready' ? `#${formState.data.crew.number} ${formState.data.crew.name}` : formState.status === 'loading' ? crewTexts.crewLoading : '';
  // Gare dei campionati dell'equipaggio con le proteste aperte; gli altri equipaggi sono quelli del campionato della gara scelta.
  const otherCrews =
    formState.status === 'ready' && selectedRace ? formState.data.otherCrews.filter((crew) => crew.championships.includes(selectedRace.championship)) : [];
  const raceOptionLabel = (race: (typeof races)[number]) =>
    `${race.name ?? messages.races.raceLabel(race.round, race.championship)} · ${new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${race.raceDate}T12:00:00`))} · ${texts.sessions[race.session]}`;
  const isDescriptionCounterVisible = check.remainingCharacters <= PROTEST_DESCRIPTION_COUNTER_FROM;

  return (
    <Panel title={texts.title} description={texts.description}>
      <form
        className={styles.protestForm}
        noValidate
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          if (canSend) setIsConfirmOpen(true);
        }}
      >
        <p className={styles.privacyNotice} role="note">
          {texts.privacyNotice}
        </p>

        <FormField
          label={crewTexts.crew}
          hint={formState.status === 'ready' ? crewTexts.crewHint : undefined}
          errorMessage={formState.status === 'problem' ? crewTexts.crewProblems[formState.problem] : undefined}
        >
          {({ isInvalid, ...inputAttributes }) => <Input {...inputAttributes} type="text" readOnly isInvalid={isInvalid} value={crewValue} onValueChange={() => undefined} />}
        </FormField>

        <div className={styles.fieldRow}>
          <FormField
            label={texts.race}
            hint={formState.status === 'ready' && races.length > 0 ? texts.raceHint : undefined}
            errorMessage={formState.status === 'ready' && races.length === 0 ? texts.noRaces : undefined}
          >
            {(controlProps) => (
              <Select
                id={controlProps.id}
                aria-describedby={controlProps['aria-describedby']}
                placeholderLabel={texts.racePlaceholder}
                value={values.raceId}
                options={races.map((race) => ({ value: String(race.id), label: raceOptionLabel(race) }))}
                disabled={races.length === 0}
                onValueChange={(raceId) => {
                  // Cambiando gara (e magari campionato) gli equipaggi scelti si tolgono.
                  setValues((previousValues) => ({ ...previousValues, raceId, otherCrewIds: [] }));
                }}
              />
            )}
          </FormField>
          {isQualifying ? (
            <p className={styles.qualifyingNotice} role="status">
              {texts.qualifyingNotice}
            </p>
          ) : (
            <FormField label={texts.stint} hint={texts.stintHint} errorMessage={check.isStintInvalid ? texts.stintInvalid(PROTEST_STINT_MAX) : undefined}>
              {({ isInvalid, ...inputAttributes }) => (
                <Input {...inputAttributes} type="text" inputMode="numeric" maxLength={2} isInvalid={isInvalid} value={values.stint} onValueChange={(stint) => change('stint', digitsOnly(stint, 2))} />
              )}
            </FormField>
          )}
          <FormField label={texts.lap} hint={texts.lapHint} errorMessage={check.isLapInvalid ? texts.lapInvalid(PROTEST_LAP_MAX) : undefined}>
            {({ isInvalid, ...inputAttributes }) => (
              <Input {...inputAttributes} type="text" inputMode="numeric" maxLength={3} isInvalid={isInvalid} value={values.lap} onValueChange={(lap) => change('lap', digitsOnly(lap, 3))} />
            )}
          </FormField>
          <FormField label={texts.corner} hint={texts.cornerHint} errorMessage={check.isCornerInvalid ? texts.cornerInvalid : undefined}>
            {({ isInvalid, ...inputAttributes }) => (
              <Input {...inputAttributes} type="text" maxLength={60} isInvalid={isInvalid} value={values.corner} onValueChange={(corner) => change('corner', corner)} />
            )}
          </FormField>
        </div>

        <FormField label={texts.otherCrews} hint={texts.otherCrewsHint}>
          {(controlProps) => (
            <CrewMultiPicker
              id={controlProps.id}
              aria-describedby={controlProps['aria-describedby']}
              crews={otherCrews}
              selectedCrewIds={values.otherCrewIds}
              onToggleCrew={(crewId) =>
                change('otherCrewIds', values.otherCrewIds.includes(crewId) ? values.otherCrewIds.filter((id) => id !== crewId) : [...values.otherCrewIds, crewId])
              }
              listLabel={texts.otherCrews}
              placeholder={texts.otherCrewsPlaceholder}
              crewOptionLabel={(crew) => `#${crew.number} ${crew.name}`}
              disabled={formState.status !== 'ready' || otherCrews.length === 0}
            />
          )}
        </FormField>

        <FormField label={texts.descriptionLabel} hint={texts.descriptionHint}>
          {({ isInvalid, ...textareaAttributes }) => (
            <div className={styles.descriptionField}>
              <Textarea
                {...textareaAttributes}
                rows={5}
                maxLength={PROTEST_DESCRIPTION_MAX_LENGTH}
                isInvalid={isInvalid}
                value={values.description}
                onValueChange={(description) => change('description', description)}
              />
              {isDescriptionCounterVisible && (
                <p className={styles.characterCounter} data-exhausted={check.remainingCharacters === 0 || undefined} aria-live="polite">
                  {texts.charactersLeft(check.remainingCharacters)}
                </p>
              )}
            </div>
          )}
        </FormField>

        <div className={styles.videoGroup}>
          <p className={styles.groupLabel}>{texts.video}</p>
          <VideoDropzone
            video={values.video}
            disabled={isSending}
            errorMessage={check.videoIssue ? texts.videoIssues[check.videoIssue] : undefined}
            onChange={(video) => change('video', video)}
          />
          <FormField label={texts.youtube} hint={texts.youtubeHint} errorMessage={check.isYoutubeInvalid ? texts.youtubeInvalid : undefined}>
            {({ isInvalid, ...inputAttributes }) => (
              <Input
                {...inputAttributes}
                type="text"
                inputMode="url"
                placeholder="https://youtu.be/…"
                spellCheck={false}
                isInvalid={isInvalid}
                value={values.youtubeUrl}
                onValueChange={(youtubeUrl) => change('youtubeUrl', youtubeUrl)}
              />
            )}
          </FormField>
        </div>

        {uploadFraction !== null && (
          <div className={styles.uploadProgress} role="status">
            <span>{texts.uploading(Math.round(uploadFraction * 100))}</span>
            <ProgressBar value={uploadFraction * 100} maximum={100} accessibleLabel={texts.video} />
          </div>
        )}
        {failure && <InlineAlert>{texts.errors[failure]}</InlineAlert>}

        <Button type="submit" variant="confirm" disabled={!canSend}>
          {isSending ? texts.sending : texts.submit}
        </Button>
      </form>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={texts.confirmTitle}
        description={texts.confirmDescription}
        confirmLabel={crewTexts.confirm}
        cancelLabel={crewTexts.cancel}
        confirmVariant="confirm"
        onConfirm={() => void send()}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </Panel>
  );
}
