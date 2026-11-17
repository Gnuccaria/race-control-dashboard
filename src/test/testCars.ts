import type { Car } from '@shared/carRules';

/** Le stesse auto (e gli stessi id) inserite dalla migrazione 0005 del server. */
export const TEST_CARS: Car[] = ['Audi', 'BMW', 'Ferrari', 'Lamborghini', 'Nissan', 'Porsche'].map((manufacturer, index) => ({
  id: index + 1,
  manufacturer,
  model: null,
  // Gruppi solo per i filtri: la Nissan è una Gr.4, la Porsche una Gr.1, le altre Gr.3.
  group: manufacturer === 'Nissan' ? 'Gr.4' : manufacturer === 'Porsche' ? 'Gr.1' : 'Gr.3',
  horsepower: null,
  weightKg: null,
  drivetrain: null,
  bopHorsepower: null,
  bopWeightKg: null,
  limiter: null,
  ballastKg: null,
  // Come dopo la migrazione 0027: tutte del Cool1 FIE; la Nissan anche dell'All Japan GT, per provare più campionati.
  championships: manufacturer === 'Nissan' ? ['Cool1 FIE Championship', 'All Japan GT Championship'] : ['Cool1 FIE Championship'],
}));

export const testCarId = (manufacturer: string): number => TEST_CARS.find((car) => car.manufacturer === manufacturer)?.id ?? 0;
