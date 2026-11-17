import type { Car, CarRefreshPreview, CarSourceMatch } from '@shared/carRules';
import { requestServerApi } from '@/services/serverApi';

/** Auto della tabella cars sul server. */
export const fetchCars = () =>
  requestServerApi({ method: 'GET', path: '/cars' }, (responseBody) => (responseBody as { cars: Car[] }).cars);

/**
 * Aggiornamento dai siti (catalogo ufficiale di GT7 e BoP Midspeed di gt-engine.com): il server li scarica e risponde
 * con l'anteprima; con apply: true salva anche e restituisce le vetture aggiornate.
 */
export const refreshCars = (matches: readonly CarSourceMatch[], apply: boolean) =>
  requestServerApi({ method: 'POST', path: '/cars/refresh', body: { matches, apply } }, (responseBody) => responseBody as { preview: CarRefreshPreview; cars?: Car[] });
