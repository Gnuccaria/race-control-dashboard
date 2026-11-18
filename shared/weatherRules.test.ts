import { describe, expect, it } from 'vitest';
import { fitWeatherPattern, readWeatherPattern, WEATHER_CODES, weatherKindOf } from './weatherRules';

describe('pattern meteo', () => {
  it('ha i codici S01–S13, C01–C06, R01–R08 e il tipo di meteo di ognuno', () => {
    expect(WEATHER_CODES).toHaveLength(27);
    expect([WEATHER_CODES[0], WEATHER_CODES[12], WEATHER_CODES[13], WEATHER_CODES[26]]).toEqual(['S01', 'S13', 'C01', 'R08']);
    expect(['S01', 'S07', 'S08', 'S13', 'C01', 'C03', 'C04', 'C06', 'R01', 'R04', 'R05', 'R08'].map(weatherKindOf)).toEqual([
      'sun', 'sun', 'sun-fog', 'sun-fog', 'light-clouds', 'light-clouds', 'dense-clouds', 'dense-clouds', 'light-rain', 'light-rain', 'heavy-rain', 'heavy-rain',
    ]);
  });

  it('vuole la qualifica con 2 slot e una riga di 9 slot per ogni stint, tutti compilati', () => {
    const stints = [Array(9).fill('S01'), Array(9).fill('R08')];
    expect(readWeatherPattern({ qualifying: ['S01', 'C06'], stints }, 2)).toEqual({ qualifying: ['S01', 'C06'], stints });
    expect(readWeatherPattern({ qualifying: ['S01', 'C06'], stints }, 3)).toBeNull();
    expect(readWeatherPattern({ qualifying: ['S01', ''], stints }, 2)).toBeNull();
    expect(readWeatherPattern({ qualifying: ['S01', 'C06'], stints: [Array(9).fill('S01'), Array(9).fill('X01')] }, 2)).toBeNull();
    expect(fitWeatherPattern({ qualifying: ['S01', 'C06'], stints }, 3).stints[2]).toEqual(Array(9).fill(''));
  });
});
