import type { Car } from '@shared/carRules';
import { requestServerApi } from '@/services/serverApi';

/** Auto della tabella cars sul server. */
export const fetchCars = () =>
  requestServerApi({ method: 'GET', path: '/cars' }, (responseBody) => (responseBody as { cars: Car[] }).cars);
