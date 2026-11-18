import type { RaceWeather, WeatherPattern } from '@shared/weatherRules';
import { requestServerApi } from '@/services/serverApi';

const readWeather = (responseBody: unknown) => (responseBody as { weather: RaceWeather }).weather;

export const fetchRaceWeather = (raceId: number) => requestServerApi({ method: 'GET', path: `/races/${raceId}/weather` }, readWeather);

export const saveRaceWeather = (raceId: number, pattern: WeatherPattern) =>
  requestServerApi({ method: 'PUT', path: `/races/${raceId}/weather`, body: { pattern } }, readWeather);
