import { readWeatherPattern, type RaceWeather, STINT_WEATHER_SLOTS, QUALIFYING_WEATHER_SLOTS, WEATHER_CODES, type WeatherPattern, weatherKindOf } from '@shared/weatherRules';
import { useState } from 'react';
import { EditingActions } from '@/components/editing/EditingActions';
import { LeaveEditingGuard } from '@/components/editing/LeaveEditingGuard';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Panel } from '@/components/ui/Panel/Panel';
import { Select } from '@/components/ui/Select/Select';
import { WeatherIcon } from '@/components/ui/WeatherIcon/WeatherIcon';
import { useEditingSession } from '@/hooks/useEditingSession';
import { useI18n } from '@/i18n/useI18n';
import { serverErrorText } from '@/services/serverErrorText';
import { saveRaceWeather } from '../services/weatherApi';
import { WeatherPatternGrid } from './WeatherPatternGrid';
import styles from './WeatherPatternEditor.module.css';

const CODE_OPTIONS = WEATHER_CODES.map((code) => ({ value: code, label: code }));

/** Righe da compilare: quelle salvate oppure vuote (''), una per la qualifica e una per ogni stint. */
function toRows(weather: RaceWeather): string[][] {
  const empty = (length: number) => Array.from({ length }, () => '');
  return [
    weather.pattern ? [...weather.pattern.qualifying] : empty(QUALIFYING_WEATHER_SLOTS),
    ...Array.from({ length: weather.stintCount }, (_unused, index) => (weather.pattern?.stints[index] ? [...weather.pattern.stints[index]] : empty(STINT_WEATHER_SLOTS))),
  ];
}

interface PatternFormProps {
  readonly weather: RaceWeather;
  readonly isEditing: boolean;
  readonly isSaving: boolean;
  readonly onEdit: () => void;
  readonly onCancel: () => void;
  readonly onSave: (pattern: WeatherPattern) => void;
}

/** Un menu per slot (S01…R08) con l'icona del meteo scelto; rimontato (nuova key) torna ai valori salvati. */
function PatternForm({ weather, isEditing, isSaving, onEdit, onCancel, onSave }: PatternFormProps) {
  const { messages } = useI18n();
  const texts = messages.weather;
  const [rows, setRows] = useState(() => toRows(weather));
  const [qualifying = [], ...stints] = rows;
  const pattern = readWeatherPattern({ qualifying, stints }, weather.stintCount);
  const emptySlots = rows.flat().filter((code) => code === '').length;

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        if (pattern) onSave(pattern);
      }}
    >
      <WeatherPatternGrid
        stintCount={weather.stintCount}
        renderSlot={({ row, slot, label }) => {
          const code = rows[row]?.[slot] ?? '';
          return (
            <span className={styles.slot}>
              {/* Spazio fisso per l'icona, così i menu restano allineati anche negli slot ancora vuoti. */}
              <span className={styles.icon}>
                <WeatherIcon code={code} label={code === '' ? '' : texts.kinds[weatherKindOf(code)]} />
              </span>
              <Select
                aria-label={label}
                className={styles.select}
                disabled={!isEditing}
                placeholderLabel="--"
                value={code}
                options={CODE_OPTIONS}
                onValueChange={(nextCode) => {
                  setRows((previous) => previous.map((cells, rowIndex) => (rowIndex === row ? cells.map((cell, slotIndex) => (slotIndex === slot ? nextCode : cell)) : cells)));
                }}
              />
            </span>
          );
        }}
      />
      {isEditing && emptySlots > 0 && <p className={styles.hint}>{texts.emptySlots(emptySlots)}</p>}
      <EditingActions isEditing={isEditing} isSaving={isSaving} canSave={pattern !== null} onEdit={onEdit} onCancel={onCancel} />
    </form>
  );
}

interface WeatherPatternEditorProps {
  readonly raceId: number;
  readonly weather: RaceWeather;
  readonly onSaved: (weather: RaceWeather) => void;
}

/** Pattern meteo di una gara: in sola lettura finché non si preme "Modifica"; si salva solo con tutti gli slot. */
export function WeatherPatternEditor({ raceId, weather, onSaved }: WeatherPatternEditorProps) {
  const { messages } = useI18n();
  const texts = messages.weather;
  const editing = useEditingSession((pattern: WeatherPattern) => saveRaceWeather(raceId, pattern), onSaved);

  return (
    <Panel title={texts.panelTitle} description={editing.isEditing ? texts.editingDescription : texts.readOnlyDescription}>
      {editing.savedMessageVisible && <InlineAlert tone="success">{messages.editing.saved}</InlineAlert>}
      {editing.saveErrorKind && <InlineAlert>{serverErrorText(messages, editing.saveErrorKind)}</InlineAlert>}
      {weather.stintCount === 0 ? (
        <InlineAlert>{texts.noStints}</InlineAlert>
      ) : (
        <PatternForm
          key={editing.formKey}
          weather={weather}
          isEditing={editing.isEditing}
          isSaving={editing.isSaving}
          onEdit={editing.startEditing}
          onCancel={editing.cancelEditing}
          onSave={editing.save}
        />
      )}
      <LeaveEditingGuard isActive={editing.isEditing} />
    </Panel>
  );
}
