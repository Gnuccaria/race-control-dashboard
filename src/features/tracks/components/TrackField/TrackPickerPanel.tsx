import type { Track } from '@shared/raceRules';
import { useState } from 'react';
import { FormField } from '@/components/form/FormField/FormField';
import { Button } from '@/components/ui/Button/Button';
import { Checkbox } from '@/components/ui/Checkbox/Checkbox';
import { Select } from '@/components/ui/Select/Select';
import { useI18n } from '@/i18n/useI18n';
import type { TrackCatalog } from '../../useTrackCatalog';
import {
  canReverse,
  chooseConfiguration,
  chooseContinent,
  chooseTrackName,
  listConfigurations,
  listContinents,
  listTrackNames,
  type TrackChoice,
  type TrackPickerDraft,
  toPickerDraft,
} from '../../model/trackSelection';
import { useTrackLabels } from '../../useTrackLabels';
import styles from './TrackField.module.css';

interface TrackPickerPanelProps {
  readonly catalog: TrackCatalog;
  readonly initialChoice: TrackChoice;
  readonly onConfirm: (choice: TrackChoice, track: Track) => void;
  readonly onRemove: (() => void) | undefined;
  readonly onCancel: () => void;
}

/** Contenuto del popup: tre menu a cascata, la casella "al contrario" e i pulsanti. */
export function TrackPickerPanel({ catalog, initialChoice, onConfirm, onRemove, onCancel }: TrackPickerPanelProps) {
  const { messages, locale } = useI18n();
  const trackTexts = messages.tracks;
  const { continentLabel, configurationLabel } = useTrackLabels();
  const { tracks } = catalog;
  // null = l'utente non ha ancora toccato i menu: si mostra la scelta attuale appena le piste sono pronte.
  const [editedDraft, setEditedDraft] = useState<TrackPickerDraft | null>(null);
  const draft = editedDraft ?? toPickerDraft(tracks, initialChoice);

  const continents = listContinents(tracks);
  const trackNames = draft.continent === '' ? [] : listTrackNames(tracks, draft.continent);
  const configurations = draft.trackName === '' ? [] : listConfigurations(tracks, draft.continent, draft.trackName);
  const selectedTrack = configurations.find((track) => track.id === draft.trackId);
  const lengthFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });

  const catalogMessage = catalog.errorKind
    ? messages.serverErrors[catalog.errorKind]
    : catalog.isLoading
      ? trackTexts.loading
      : tracks.length === 0
        ? trackTexts.noTracks
        : null;

  return (
    <div className={styles.pickerPanel}>
      {catalogMessage && (
        <p className={styles.catalogMessage} role={catalog.errorKind ? 'alert' : 'status'}>
          {catalogMessage}
        </p>
      )}

      <div className={styles.pickerFields}>
        <FormField label={trackTexts.continent}>
          {(controlProps) => (
            <Select
              id={controlProps.id}
              aria-describedby={controlProps['aria-describedby']}
              disabled={continents.length === 0}
              placeholderLabel={trackTexts.continentPlaceholder}
              value={draft.continent}
              options={continents.map((continent) => ({ value: continent, label: continentLabel(continent) }))}
              onValueChange={(continent) => {
                setEditedDraft(chooseContinent(continent));
              }}
            />
          )}
        </FormField>

        <FormField label={trackTexts.track} hint={draft.continent === '' ? trackTexts.chooseContinentFirst : undefined}>
          {(controlProps) => (
            <Select
              id={controlProps.id}
              aria-describedby={controlProps['aria-describedby']}
              disabled={draft.continent === ''}
              placeholderLabel={trackTexts.trackPlaceholder}
              value={draft.trackName}
              options={trackNames.map((trackName) => ({ value: trackName, label: trackName }))}
              onValueChange={(trackName) => {
                setEditedDraft(chooseTrackName(tracks, draft, trackName));
              }}
            />
          )}
        </FormField>

        <FormField label={trackTexts.configuration} hint={draft.trackName === '' ? trackTexts.chooseTrackFirst : undefined}>
          {(controlProps) => (
            <Select
              id={controlProps.id}
              aria-describedby={controlProps['aria-describedby']}
              disabled={draft.trackName === ''}
              placeholderLabel={trackTexts.configurationPlaceholder}
              value={draft.trackId === null ? '' : String(draft.trackId)}
              options={configurations.map((track) => ({
                value: String(track.id),
                label: configurationLabel(track.configuration),
              }))}
              onValueChange={(trackIdText) => {
                setEditedDraft(chooseConfiguration(draft, Number(trackIdText)));
              }}
            />
          )}
        </FormField>
      </div>

      {selectedTrack && (
        <div className={styles.trackDetails}>
          {selectedTrack.lengthMeters !== null && (
            <p className={styles.trackLength}>{trackTexts.lengthLabel(lengthFormatter.format(selectedTrack.lengthMeters / 1000))}</p>
          )}
          {canReverse(selectedTrack) && (
            <Checkbox
              label={trackTexts.reverseLabel}
              description={trackTexts.reverseDescription}
              isChecked={draft.isReversed}
              onCheckedChange={(isReversed) => {
                setEditedDraft({ ...draft, isReversed });
              }}
            />
          )}
        </div>
      )}

      <div className={styles.pickerActions}>
        {onRemove && (
          <Button variant="quiet" className={styles.removeTrackButton} onClick={onRemove}>
            {trackTexts.remove}
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          {trackTexts.cancel}
        </Button>
        <Button
          variant="confirm"
          disabled={!selectedTrack}
          onClick={() => {
            if (selectedTrack) onConfirm({ trackId: selectedTrack.id, isReversed: draft.isReversed }, selectedTrack);
          }}
        >
          {trackTexts.confirm}
        </Button>
      </div>
    </div>
  );
}
