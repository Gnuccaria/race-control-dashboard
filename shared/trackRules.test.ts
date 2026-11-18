import { describe, expect, it } from 'vitest';
import { isTrackMapFile, readLegacyTrackMatches, readTrackMapMatches, toCountryCode, trackLengthUnits, trackMapUrl } from './trackRules';

describe('regole dei tracciati', () => {
  it('nazioni del wiki → codice ISO a due lettere', () => {
    expect(['ITA', 'GER', 'CRO', 'UAE', 'Switzerland', 'gbr', 'US'].map(toCountryCode)).toEqual(['IT', 'DE', 'HR', 'AE', 'CH', 'GB', 'US']);
    expect(toCountryCode('Atlantide')).toBeNull();
  });

  it('mappe: solo nomi di file di gt-engine, indirizzo costruito dal server', () => {
    expect(isTrackMapFile('alsace-village-2.png')).toBe(true);
    expect(['../x.png', 'a.jpg', 'https://x/a.png', 'A.png'].some(isTrackMapFile)).toBe(false);
    expect(trackMapUrl('../x.png')).toBeNull();
  });

  it('abbinamenti dalla richiesta', () => {
    expect(readTrackMapMatches(undefined)).toEqual([]);
    expect(readTrackMapMatches([{ sourceKey: 'monza|full course', mapFile: null }])).toEqual([{ sourceKey: 'monza|full course', mapFile: null }]);
    expect(readTrackMapMatches([{ sourceKey: '', mapFile: null }])).toBeNull();
    expect(readLegacyTrackMatches([{ trackId: 3, sourceKey: 'monza|full course' }])).toEqual([{ trackId: 3, sourceKey: 'monza|full course' }]);
    expect(readLegacyTrackMatches([{ trackId: 1.5, sourceKey: null }])).toBeNull();
  });

  it('lunghezza in km e miglia', () => {
    expect(trackLengthUnits(5809)).toEqual({ km: 5.809, miles: 3.61 });
  });
});
