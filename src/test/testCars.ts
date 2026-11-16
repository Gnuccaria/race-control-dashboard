import type { Car } from '@shared/carRules';

/** Le stesse auto (e gli stessi id) inserite dalla migrazione 0005 del server. */
export const TEST_CARS: Car[] = ['Audi', 'BMW', 'Ferrari', 'Lamborghini', 'Nissan', 'Porsche'].map((manufacturer, index) => ({
  id: index + 1,
  manufacturer,
  model: null,
  horsepower: null,
  weightKg: null,
  limiter: null,
  ballastKg: null,
}));

export const testCarId = (manufacturer: string): number => TEST_CARS.find((car) => car.manufacturer === manufacturer)?.id ?? 0;
