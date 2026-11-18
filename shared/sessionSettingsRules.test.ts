import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_SETTINGS,
  isSessionSettingEnabled,
  parseStoredSessionSettings,
  QUALIFYING_SETTING_KEYS,
  qualifyingContext,
  rangeStops,
  readSessionSettings,
  SESSION_SETTING_DEFINITIONS,
  SESSION_SETTING_SECTIONS,
  sessionSettingDefinition,
} from './sessionSettingsRules';

const { race, qualifying } = DEFAULT_SESSION_SETTINGS;

describe('impostazioni di sessione', () => {
  it('sezioni come nel gioco: ogni voce una volta sola, più "Opzioni impostazioni" bloccata', () => {
    const slots = SESSION_SETTING_SECTIONS.flatMap((section) => section.slots);
    expect(slots.filter((slot) => slot !== 'settingsOptions')).toEqual(SESSION_SETTING_DEFINITIONS.map((definition) => definition.key));
    expect(slots.slice(0, 4)).toEqual(['startType', 'startingGrid', 'bopNoTuning', 'settingsOptions']);
    expect(SESSION_SETTING_SECTIONS.map((section) => section.id)).toEqual(['race', 'regulation', 'penalties', 'drivingOptions']);
  });

  it('la qualifica non ha soste minime, cambio di mescola obbligato, tempo per completare la gara né corsia dei box', () => {
    const withoutQualifying = SESSION_SETTING_DEFINITIONS.filter((definition) => !QUALIFYING_SETTING_KEYS.includes(definition.key as never)).map(
      (definition) => definition.key,
    );
    expect(withoutQualifying).toEqual(['timeToFinish', 'minPitStops', 'mandatoryTyreChange', 'pitLaneCutPenalty']);
    expect(Object.keys(qualifying)).toEqual(QUALIFYING_SETTING_KEYS);
  });

  it('valori iniziali come negli screenshot del gioco', () => {
    expect(race).toMatchObject({
      startType: 'grid',
      startingGrid: 'fastestFirst',
      bopNoTuning: 'no',
      boost: 'off',
      slipstream: 'weak',
      visibleDamage: 'yes',
      mechanicalDamage: 'none',
      tyreWear: 0,
      fuelConsumption: 0,
      initialFuel: null,
      offTrackGrip: 'low',
      timeToFinish: 30,
      minPitStops: 0,
      overtakeMultiplier: 1,
      ppLimit: null,
      usableTyres: 'noLimit',
      usableCompounds: ['hard', 'medium', 'soft'],
      requiredCompounds: [],
      aspiration: 'unrestricted',
      wallCollisionCorrection: 'yes',
      flags: 'yes',
      abs: 'noLimit',
    });
  });

  it('slider: "Nessun limite" o "Predefinita" a sinistra, poi da min a max con il passo', () => {
    const pp = sessionSettingDefinition('ppLimit');
    const timeToFinish = sessionSettingDefinition('timeToFinish');
    const yearMax = sessionSettingDefinition('yearMax');
    if (pp.kind !== 'range' || timeToFinish.kind !== 'range' || yearMax.kind !== 'range') throw new Error('slider attesi');
    const ppStops = rangeStops(pp);
    expect([ppStops[0], ppStops[1], ppStops.at(-1), ppStops.length]).toEqual([null, 100, 1000, 92]);
    expect(rangeStops(timeToFinish)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180]);
    expect([rangeStops(yearMax)[1], rangeStops(yearMax).at(-1)]).toEqual([1920, 2026]);
  });

  it('voci collegate: rifornimento con consumo, mescole con gomme da corsa, cambio di mescola con almeno una sosta', () => {
    expect(isSessionSettingEnabled('refuelSpeed', race)).toBe(false);
    expect(isSessionSettingEnabled('initialFuel', { ...race, fuelConsumption: 1 })).toBe(true);
    expect(isSessionSettingEnabled('usableCompounds', race)).toBe(false);
    expect(isSessionSettingEnabled('requiredCompounds', { ...race, usableTyres: 'racing' })).toBe(true);
    expect(isSessionSettingEnabled('mandatoryTyreChange', { ...race, minPitStops: 1 })).toBe(true);
    // La qualifica usa le soste della gara (non le ha).
    expect(isSessionSettingEnabled('mandatoryTyreChange', qualifyingContext({ race: { ...race, minPitStops: 2 }, qualifying }))).toBe(true);
    expect(isSessionSettingEnabled('abs', race)).toBe(true);
  });

  it('convalida: valori ammessi, mescole in ordine, richieste tra le utilizzabili, anni in ordine', () => {
    const settings = {
      race: { ...race, usableCompounds: ['soft', 'hard'], requiredCompounds: ['soft'], yearMin: 1990, yearMax: 1990 },
      qualifying: { ...qualifying, extra: 'ignorata' },
    };
    const reading = readSessionSettings(settings);
    expect(reading.isValid && reading.settings.race.usableCompounds).toEqual(['hard', 'soft']);
    expect(reading.isValid && reading.settings.qualifying).not.toHaveProperty('extra');
    expect(readSessionSettings({ race: { ...race, refuelSpeed: 0 }, qualifying })).toEqual({ isValid: false, session: 'race', key: 'refuelSpeed' });
    expect(readSessionSettings({ race: { ...race, minWeight: 2001 }, qualifying })).toMatchObject({ key: 'minWeight' });
    expect(readSessionSettings({ race: { ...race, timeToFinish: 35 }, qualifying })).toMatchObject({ key: 'timeToFinish' });
    expect(readSessionSettings({ race: { ...race, usableCompounds: ['hard', 'hard'] }, qualifying })).toMatchObject({ key: 'usableCompounds' });
    expect(readSessionSettings({ race, qualifying: { ...qualifying, requiredCompounds: ['wet'] } })).toEqual({
      isValid: false,
      session: 'qualifying',
      key: 'requiredCompounds',
    });
    expect(readSessionSettings({ race, qualifying: { ...qualifying, yearMin: 2010, yearMax: 2000 } })).toMatchObject({ session: 'qualifying', key: 'yearMax' });
  });

  it('impostazioni salvate: mancanti o non valide diventano quelle iniziali', () => {
    expect(parseStoredSessionSettings(null)).toBe(DEFAULT_SESSION_SETTINGS);
    expect(parseStoredSessionSettings('{')).toBe(DEFAULT_SESSION_SETTINGS);
    const saved = { race: { ...race, boost: 'strong' }, qualifying };
    expect(parseStoredSessionSettings(JSON.stringify(saved))).toEqual(saved);
  });
});
