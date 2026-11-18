import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { planCrewImport } from '../src/import/crewCsvImport';
import { parseCsvNumber } from '../src/import/csv';


describe('numeri nei CSV', () => {
  it('legge i numeri scritti all\'italiana', () => {
    expect(parseCsvNumber('1.250')).toBe(1250);
    expect(parseCsvNumber('95,5')).toBe(95.5);
    expect(parseCsvNumber(' 20% ')).toBe(20);
    expect(parseCsvNumber('')).toBeNull();
    expect(Number.isNaN(parseCsvNumber('tanti'))).toBe(true);
  });
});

describe('file pronti in server/data', () => {
  const readDataFile = (fileName: string) => readFileSync(join(import.meta.dirname, '../data', fileName), 'utf8');

  it('crews.csv: i 15 equipaggi FIE, riconosciuti dalle intestazioni in inglese', () => {
    const { crews, problems } = planCrewImport(readDataFile('crews.csv'), [], ['All Japan GT Championship', 'Cool1 FIE Championship']);
    expect(problems).toEqual([]);
    expect(crews).toHaveLength(15);
    expect(crews[0]).toMatchObject({ name: 'Vez Team Lime', number: 16, championships: [{ championship: 'Cool1 FIE Championship', carId: null }], color: null });
    expect(crews.map((crew) => crew.name)).toContain('Sim Racing Café');
  });


  it('races.csv e race_results.csv hanno solo l\'intestazione', () => {
    for (const fileName of ['races.csv', 'race_results.csv']) {
      expect(readDataFile(fileName).trim().split('\n')).toHaveLength(1);
    }
  });
});
