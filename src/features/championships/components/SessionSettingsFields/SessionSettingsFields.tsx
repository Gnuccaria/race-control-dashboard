import {
  hasQualifyingSetting,
  isSessionSettingEnabled,
  LOCKED_SETTINGS_OPTIONS,
  qualifyingContext,
  rangeStops,
  SESSION_SETTING_SECTIONS,
  type SessionContext,
  type SessionSettingDefinition,
  type SessionSettingKey,
  type SessionSettingValue,
  sessionSettingDefinition,
  TYRE_COMPOUNDS,
  type TyreCompound,
} from '@shared/sessionSettingsRules';
import { Checkbox } from '@/components/ui/Checkbox/Checkbox';
import { Select } from '@/components/ui/Select/Select';
import { useI18n } from '@/i18n/useI18n';
import type { Messages } from '@/i18n/messages';
import type { ChampionshipDraftState } from '../../hooks/useChampionshipDraft';
import styles from './SessionSettingsFields.module.css';

type SessionSettingsTexts = Messages['sessionSettings'];
type Session = 'race' | 'qualifying';

/** Gruppo di testi delle opzioni di ogni menu: alcune parole cambiano da voce a voce ("Disattivato"/"Disattivata", "Vietato"/"Proibito"). */
const OPTION_GROUP_BY_KEY: Partial<Record<SessionSettingKey, keyof SessionSettingsTexts['optionGroups']>> = {
  startType: 'startType',
  startingGrid: 'startingGrid',
  boost: 'boost',
  slipstream: 'slipstream',
  mechanicalDamage: 'mechanicalDamage',
  offTrackGrip: 'offTrackGrip',
  category: 'category',
  usableTyres: 'usableTyres',
  nitro: 'restriction',
  engineSwap: 'restriction',
  tuningParts: 'tuningParts',
  drivetrain: 'drivetrain',
  aspiration: 'aspiration',
  shortcutPenalty: 'penalty',
  wallCollisionPenalty: 'penalty',
  carCollisionPenalty: 'penalty',
  pitLaneCutPenalty: 'penalty',
  countersteerAssist: 'assist',
  stabilityControl: 'assist',
  drivingLine: 'assist',
  tractionControl: 'assist',
  abs: 'assist',
  autoDrive: 'assist',
};

function optionLabel(texts: SessionSettingsTexts, key: SessionSettingKey, option: string): string {
  const group = OPTION_GROUP_BY_KEY[key];
  const groupLabels: Readonly<Record<string, string>> = group ? texts.optionGroups[group] : texts.yesNo;
  return groupLabels[option] ?? option;
}

/** Il valore di uno slider come si legge nel gioco: "No", "3x", "30 secondi", "Nessun limite", "Predefinita"… */
function formatRangeValue(texts: SessionSettingsTexts, key: SessionSettingKey, value: number | null): string {
  const format = texts.format;
  if (value === null) return key === 'initialFuel' ? format.defaultValue : format.noLimit;
  switch (key) {
    case 'tyreWear':
    case 'fuelConsumption':
      return value === 0 ? texts.yesNo.no : format.multiplier(value);
    case 'overtakeMultiplier':
      return format.multiplier(value);
    case 'refuelSpeed':
      return format.litersPerSecond(value);
    case 'initialFuel':
      return format.percent(value);
    case 'timeToFinish':
      return format.seconds(value);
    case 'powerLimit':
      return format.power(value);
    case 'minWeight':
      return format.weight(value);
    default:
      return String(value);
  }
}

interface SettingControlProps {
  readonly settingKey: SessionSettingKey;
  readonly definition: SessionSettingDefinition;
  readonly session: Session;
  readonly label: string;
  readonly value: SessionSettingValue;
  /** Valori della sessione (per le mescole utilizzabili e le voci collegate). */
  readonly context: SessionContext;
  readonly isReadOnly: boolean;
  readonly onChange: (value: SessionSettingValue) => void;
}

/** Il comando di una voce per una sessione: menu, slider o caselle delle mescole; "--" se nel gioco è bloccata. */
function SettingControl({ settingKey, definition, session, label, value, context, isReadOnly, onChange }: SettingControlProps) {
  const { messages } = useI18n();
  const texts = messages.sessionSettings;
  const accessibleLabel = `${label} – ${texts.sessions[session]}`;

  if (!isSessionSettingEnabled(settingKey, context)) {
    return (
      <span className={styles.unavailable} aria-label={`${accessibleLabel}: ${texts.unavailable}`}>
        --
      </span>
    );
  }

  if (definition.kind === 'choice') {
    return (
      <Select
        aria-label={accessibleLabel}
        disabled={isReadOnly}
        value={value as string}
        options={definition.options.map((option) => ({ value: option, label: optionLabel(texts, settingKey, option) }))}
        onValueChange={onChange}
      />
    );
  }

  if (definition.kind === 'range') {
    const stops = rangeStops(definition);
    const index = Math.max(0, stops.indexOf(value as number | null));
    const valueText = formatRangeValue(texts, settingKey, value as number | null);
    return (
      <span className={styles.range}>
        <input
          type="range"
          className={styles.slider}
          aria-label={accessibleLabel}
          aria-valuetext={valueText}
          min={0}
          max={stops.length - 1}
          step={1}
          value={index}
          disabled={isReadOnly}
          onChange={(changeEvent) => onChange(stops[Number(changeEvent.currentTarget.value)] ?? null)}
        />
        <output className={styles.rangeValue} aria-hidden="true">
          {valueText}
        </output>
      </span>
    );
  }

  // Mescole: le utilizzabili con "Tutte" (spuntata quando lo sono tutte), le richieste solo tra le utilizzabili.
  const selected = value as readonly TyreCompound[];
  const choices = settingKey === 'usableCompounds' ? TYRE_COMPOUNDS : TYRE_COMPOUNDS.filter((compound) => (context.usableCompounds as readonly TyreCompound[]).includes(compound));
  const toggle = (compound: TyreCompound, isChecked: boolean) =>
    onChange(TYRE_COMPOUNDS.filter((candidate) => (candidate === compound ? isChecked : selected.includes(candidate))));
  return (
    <div className={styles.compounds} role="group" aria-label={accessibleLabel}>
      {settingKey === 'usableCompounds' && (
        <Checkbox
          label={texts.allCompounds}
          isChecked={selected.length === TYRE_COMPOUNDS.length}
          isDisabled={isReadOnly}
          onCheckedChange={(isChecked) => onChange(isChecked ? TYRE_COMPOUNDS : [])}
        />
      )}
      {choices.map((compound) => (
        <Checkbox
          key={compound}
          label={texts.compounds[compound]}
          isChecked={selected.includes(compound)}
          isDisabled={isReadOnly}
          onCheckedChange={(isChecked) => toggle(compound, isChecked)}
        />
      ))}
      {choices.length === 0 && <span className={styles.unavailable}>--</span>}
    </div>
  );
}

interface SessionSettingsFieldsProps {
  readonly draft: ChampionshipDraftState;
  readonly isReadOnly: boolean;
}

/**
 * Scheda "Impostazioni di sessione": le voci della creazione della stanza di Gran Turismo 7, con le stesse sezioni,
 * lo stesso ordine e la stessa disposizione su due colonne. Sotto ogni voce il valore per la qualifica (dove ha senso).
 */
export function SessionSettingsFields({ draft, isReadOnly }: SessionSettingsFieldsProps) {
  const { messages } = useI18n();
  const texts = messages.sessionSettings;
  const { race, qualifying } = draft.values.sessionSettings;
  const contexts: Record<Session, SessionContext> = { race, qualifying: qualifyingContext({ race, qualifying }) };
  const issue = draft.sessionSettingsIssue;

  return (
    <div className={styles.sections}>
      {!isReadOnly && <p className={styles.hint}>{texts.hint}</p>}
      {SESSION_SETTING_SECTIONS.map((section) => (
        <section key={section.id} className={styles.section} aria-labelledby={`session-settings-${section.id}`}>
          <h3 id={`session-settings-${section.id}`} className={styles.sectionTitle}>
            {texts.sections[section.id]}
          </h3>
          <div className={styles.grid}>
            {section.slots.map((slot) => {
              if (slot === LOCKED_SETTINGS_OPTIONS) {
                return (
                  <div key={slot} className={styles.card} data-locked="true">
                    <span className={styles.cardLabel}>{texts.labels.settingsOptions}</span>
                    <span className={styles.locked}>{texts.allOptions}</span>
                  </div>
                );
              }
              const definition = sessionSettingDefinition(slot);
              const label = texts.labels[slot];
              const sessions: Session[] = hasQualifyingSetting(slot) ? ['race', 'qualifying'] : ['race'];
              const errorSession = issue?.key === slot ? issue.session : null;
              return (
                <div key={slot} className={styles.card}>
                  <span className={styles.cardLabel}>{label}</span>
                  {sessions.map((session) => (
                    <div key={session} className={styles.sessionRow}>
                      <span className={styles.sessionTag}>{texts.sessions[session]}</span>
                      <SettingControl
                        settingKey={slot}
                        definition={definition}
                        session={session}
                        label={label}
                        value={session === 'race' ? race[slot] : (qualifying as Readonly<Record<string, SessionSettingValue>>)[slot] ?? null}
                        context={contexts[session]}
                        isReadOnly={isReadOnly}
                        onChange={(value) => (session === 'race' ? draft.changeRaceSetting(slot, value) : draft.changeQualifyingSetting(slot, value))}
                      />
                      {!isReadOnly && errorSession === session && (
                        <span className={styles.error} role="alert">
                          {texts.issues[slot as keyof SessionSettingsTexts['issues']] ?? texts.issues.generic}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
