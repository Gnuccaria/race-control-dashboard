import type { SavedCrew } from '@shared/crewRules';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CREW_SORT,
  EMPTY_CREW_FILTERS,
  filterCrews,
  findMissingCrewFields,
  hasActiveFilters,
  sortCrews,
  toggleCrewSort,
} from './crewList';

const crew = (
  id: number,
  name: string,
  number: number,
  carId: SavedCrew['carId'],
  championship: SavedCrew['championship'],
  color: SavedCrew['color'] = '#E10600',
): SavedCrew => ({ id, name, number, carId, championship, color, createdAt: '2026-11-13T00:00:00Z' });

const CREWS: SavedCrew[] = [
  crew(1, 'Sim Racing Café', 690, null, 'Cool1 FIE Championship'),
  crew(2, 'GT Tribe Team Yellow', 20, 6, 'Cool1 FIE Championship'),
  crew(3, 'alberto Ciola Racing', 67, 1, null),
  crew(4, 'GT Tribe Team Purple', 21, 2, 'Cool1 FIE Championship'),
  crew(5, 'Team 10', 120, null, null),
  crew(6, 'Team 2', 2, 1, 'Cool1 FIE Championship'),
];

const CAR_NAMES = new Map([
  [1, 'Audi'],
  [2, 'BMW'],
  [6, 'Porsche'],
]);

const numbersOf = (crews: readonly SavedCrew[]) => crews.map((savedCrew) => savedCrew.number);

describe('ordinamento', () => {
  it('di default per numero crescente', () => {
    expect(numbersOf(sortCrews(CREWS, DEFAULT_CREW_SORT, 'it'))).toEqual([2, 20, 21, 67, 120, 690]);
  });

  it('primo clic crescente, secondo decrescente; cambiando colonna si riparte da crescente', () => {
    const byName = toggleCrewSort(DEFAULT_CREW_SORT, 'name');
    expect(byName).toEqual({ column: 'name', direction: 'ascending' });
    expect(toggleCrewSort(byName, 'name')).toEqual({ column: 'name', direction: 'descending' });
    expect(toggleCrewSort(toggleCrewSort(byName, 'name'), 'car')).toEqual({ column: 'car', direction: 'ascending' });
    expect(toggleCrewSort(DEFAULT_CREW_SORT, 'number')).toEqual({ column: 'number', direction: 'descending' });
  });

  it('ordina i nomi A→Z e Z→A ignorando maiuscole e con i numeri in ordine naturale', () => {
    const ascending = sortCrews(CREWS, { column: 'name', direction: 'ascending' }, 'it').map((savedCrew) => savedCrew.name);
    expect(ascending).toEqual([
      'alberto Ciola Racing',
      'GT Tribe Team Purple',
      'GT Tribe Team Yellow',
      'Sim Racing Café',
      'Team 2',
      'Team 10',
    ]);
    expect(sortCrews(CREWS, { column: 'name', direction: 'descending' }, 'it')[0]?.name).toBe('Team 10');
  });

  it('i dati mancanti restano in fondo in entrambe le direzioni', () => {
    expect(numbersOf(sortCrews(CREWS, { column: 'car', direction: 'ascending' }, 'it', CAR_NAMES))).toEqual([2, 67, 21, 20, 120, 690]);
    expect(numbersOf(sortCrews(CREWS, { column: 'car', direction: 'descending' }, 'it', CAR_NAMES))).toEqual([20, 21, 2, 67, 120, 690]);
  });

  it("non modifica l'elenco originale", () => {
    const originalOrder = numbersOf(CREWS);
    sortCrews(CREWS, { column: 'number', direction: 'descending' }, 'it');
    expect(numbersOf(CREWS)).toEqual(originalOrder);
  });
});

describe('filtri', () => {
  it('la ricerca trova numero o nome, senza badare a maiuscole e accenti', () => {
    expect(numbersOf(filterCrews(CREWS, { ...EMPTY_CREW_FILTERS, searchText: '2' }))).toEqual([20, 21, 120, 2]);
    expect(numbersOf(filterCrews(CREWS, { ...EMPTY_CREW_FILTERS, searchText: 'tribe' }))).toEqual([20, 21]);
    expect(numbersOf(filterCrews(CREWS, { ...EMPTY_CREW_FILTERS, searchText: 'cafe' }))).toEqual([690]);
    expect(numbersOf(filterCrews(CREWS, { ...EMPTY_CREW_FILTERS, searchText: '  ' }))).toHaveLength(6);
  });

  it('filtra per auto e campionato, anche per dato mancante, combinando i filtri', () => {
    expect(numbersOf(filterCrews(CREWS, { ...EMPTY_CREW_FILTERS, carId: '1' }))).toEqual([67, 2]);
    expect(numbersOf(filterCrews(CREWS, { ...EMPTY_CREW_FILTERS, carId: 'missing' }))).toEqual([690, 120]);
    expect(numbersOf(filterCrews(CREWS, { ...EMPTY_CREW_FILTERS, championship: 'missing' }))).toEqual([67, 120]);
    expect(numbersOf(filterCrews(CREWS, { searchText: 'team', carId: '1', championship: 'Cool1 FIE Championship' }))).toEqual([2]);
  });

  it('sa se ci sono filtri attivi', () => {
    expect(hasActiveFilters(EMPTY_CREW_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_CREW_FILTERS, carId: '2' })).toBe(true);
  });
});

it('elenca i dati mancanti di un equipaggio', () => {
  expect(findMissingCrewFields(CREWS[4] as SavedCrew)).toEqual(['car', 'championship']);
  expect(findMissingCrewFields(CREWS[1] as SavedCrew)).toEqual([]);
  expect(findMissingCrewFields({ ...(CREWS[1] as SavedCrew), color: null })).toEqual(['color']);
});
