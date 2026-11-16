import { type Car, formatCarName } from '@shared/carRules';
import { useServerQuery } from '@/hooks/useServerQuery';
import { fetchCars } from './carApi';

/**
 * Auto lette dal server per i menu delle auto. Si caricano quando il componente compare e
 * vanno ricaricate (refresh) ogni volta che l'utente interagisce con il menu, così un'auto
 * aggiunta o modificata sul server compare subito. Durante il ricaricamento restano visibili quelle già lette.
 */
export function useCarCatalog() {
  const { queryState, reload } = useServerQuery('cars', fetchCars);
  const cars: readonly Car[] = queryState.status === 'loaded' ? queryState.value : [];

  return {
    cars,
    carNameById: new Map(cars.map((car) => [car.id, formatCarName(car)])),
    isLoading: queryState.status === 'loading',
    errorKind: queryState.status === 'failed' ? queryState.errorKind : null,
    refresh: reload,
  };
}

export type CarCatalog = ReturnType<typeof useCarCatalog>;
