import type { Track } from '@shared/raceRules';
import { FieldGrid } from '@/components/form/FieldGrid/FieldGrid';
import type { FieldBinding } from '@/components/form/fieldBinding';
import { FormField } from '@/components/form/FormField/FormField';
import { NumberField } from '@/components/form/NumberField/NumberField';
import { Panel } from '@/components/ui/Panel/Panel';
import { TrackField } from '@/features/tracks/components/TrackField/TrackField';
import type { TrackChoice } from '@/features/tracks/model/trackSelection';
import type { TrackCatalog } from '@/features/tracks/useTrackCatalog';
import { useI18n } from '@/i18n/useI18n';
import type { TrackLengthStatus } from '../../hooks/useDisconnectionCalculator';

interface TrackSettingsPanelProps {
  readonly driveThroughField: FieldBinding;
  readonly stintTotalLapsField: FieldBinding;
  readonly pitStallEntryField: FieldBinding;
  readonly trackChoice: TrackChoice;
  readonly trackCatalog: TrackCatalog;
  readonly trackLengthStatus: TrackLengthStatus;
  readonly onTrackChange: (choice: TrackChoice, track: Track | null) => void;
}

/** Variabili della pista, fisse per tutto lo stint. La lunghezza arriva dal tracciato scelto. */
export function TrackSettingsPanel({
  driveThroughField,
  stintTotalLapsField,
  pitStallEntryField,
  trackChoice,
  trackCatalog,
  trackLengthStatus,
  onTrackChange,
}: TrackSettingsPanelProps) {
  const { messages, locale } = useI18n();
  const disconnectionTexts = messages.fieDisconnections;
  const lengthFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });

  return (
    <Panel title={disconnectionTexts.trackTitle} description={disconnectionTexts.trackDescription}>
      {/* Il tracciato occupa una riga intera: il nome con la configurazione è spesso lungo. */}
      <FormField
        label={disconnectionTexts.track}
        hint={
          trackLengthStatus.kind === 'ready'
            ? disconnectionTexts.trackLengthUsed(lengthFormatter.format(trackLengthStatus.lengthKm))
            : trackLengthStatus.kind === 'no-track'
              ? disconnectionTexts.trackRequired
              : undefined
        }
        errorMessage={trackLengthStatus.kind === 'missing-length' ? disconnectionTexts.trackLengthMissing : undefined}
      >
        {({ isInvalid, ...controlProps }) => (
          <TrackField
            {...controlProps}
            isInvalid={isInvalid}
            isRemovable={false}
            value={trackChoice}
            catalog={trackCatalog}
            onValueChange={onTrackChange}
          />
        )}
      </FormField>
      <FieldGrid>
        <NumberField label={disconnectionTexts.stintTotalLaps} unit={disconnectionTexts.lapsUnit} field={stintTotalLapsField} />
        <NumberField label={disconnectionTexts.driveThrough} unit={messages.common.seconds} field={driveThroughField} />
        <NumberField
          label={disconnectionTexts.pitStallEntry}
          unit={messages.common.seconds}
          hint={disconnectionTexts.pitStallEntryHint}
          field={pitStallEntryField}
        />
      </FieldGrid>
    </Panel>
  );
}
