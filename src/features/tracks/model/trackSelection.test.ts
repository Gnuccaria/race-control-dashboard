import { describe, expect, it } from 'vitest';
import { TEST_TRACKS } from '@/test/testTracks';
import {
  canReverse,
  chooseConfiguration,
  chooseCountry,
  chooseTrackName,
  formatTrackChoice,
  listConfigurations,
  listCountries,
  listTrackNames,
  NO_COUNTRY,
  toPickerDraft,
  translateTrackTerm,
} from './trackSelection';

/** Pista di prova per posizione (fallisce subito se l'elenco cambia). */
function trackAt(index: number) {
  const track = TEST_TRACKS[index];
  if (!track) throw new Error(`Manca la pista di prova ${index}`);
  return track;
}

describe('scelta del tracciato', () => {
  it('elenca nazioni (in ordine di nome), tracciati della nazione e configurazioni del tracciato', () => {
    const names: Record<string, string> = { FR: 'Francia', IT: 'Italia', JP: 'Giappone' };
    expect(listCountries([...TEST_TRACKS, { ...trackAt(0), id: 9, country: null }], (country) => names[country] ?? country)).toEqual(['FR', 'JP', 'IT', NO_COUNTRY]);
    expect(listTrackNames(TEST_TRACKS, 'JP')).toEqual(['Suzuka Circuit', 'Tsukuba Circuit']);
    expect(listConfigurations(TEST_TRACKS, 'IT', 'Monza').map((track) => track.configuration)).toEqual(['Full Course', 'No Chicane']);
  });

  it('ogni menu azzera quelli successivi; con una sola configurazione la sceglie subito', () => {
    const italy = chooseCountry('IT');
    expect(italy).toEqual({ country: 'IT', trackName: '', trackId: null, isReversed: false });
    expect(chooseTrackName(TEST_TRACKS, italy, 'Monza').trackId).toBeNull();
    const alsace = chooseTrackName(TEST_TRACKS, chooseCountry('FR'), 'Alsace');
    expect(alsace.trackId).toBe(1);
    expect(chooseConfiguration({ ...alsace, isReversed: true }, 1).isReversed).toBe(false);
  });

  it('riapre la scelta salvata e il senso inverso solo dove previsto', () => {
    expect(toPickerDraft(TEST_TRACKS, { trackId: 1, isReversed: true })).toEqual({ country: 'FR', trackName: 'Alsace', trackId: 1, isReversed: true });
    expect(toPickerDraft(TEST_TRACKS, { trackId: 2, isReversed: true }).isReversed).toBe(false);
    expect(toPickerDraft(TEST_TRACKS, { trackId: 99, isReversed: false }).trackId).toBeNull();
    expect(canReverse(TEST_TRACKS[0])).toBe(true);
    expect(canReverse(TEST_TRACKS[1])).toBe(false);
  });

  it('scrive "Tracciato - Configurazione" tradotto e, se scelto, "al contrario"', () => {
    const texts = { configurations: { 'Full Course': 'Completo', Village: 'Villaggio' }, reversedSuffix: 'al contrario' };
    expect(formatTrackChoice(trackAt(0), true, texts)).toBe('Alsace - Villaggio al contrario');
    expect(formatTrackChoice(trackAt(1), false, texts)).toBe('Monza - Completo');
    // Configurazione assente dal dizionario: resta in inglese.
    expect(formatTrackChoice(trackAt(2), false, texts)).toBe('Monza - No Chicane');
    expect(formatTrackChoice({ name: 'Broad Bean Raceway', configuration: null }, false, texts)).toBe('Broad Bean Raceway');
  });

  it('traduce senza badare a maiuscole e spazi, e lascia i nomi propri', () => {
    const dictionary = { 'Full Course': 'Completo' };
    expect(translateTrackTerm(dictionary, ' full course ')).toBe('Completo');
    expect(translateTrackTerm(dictionary, 'Nordschleife')).toBe('Nordschleife');
  });
});
