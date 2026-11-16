import { describe, expect, it } from 'vitest';
import { parseFormFields } from '@/lib/form/parseFormFields';
import { reviveStoredForm } from '@/lib/form/reviveStoredForm';
import {
  DEFAULT_LAP_CALCULATOR_FORM,
  isAllowedLapCalculatorValue,
  LAP_FIELD_PARSERS,
  parseTime,
} from './formState';

describe('form del calcolatore di giri', () => {
  it('converte i valori di esempio del foglio', () => {
    const { values, fieldErrors } = parseFormFields(LAP_FIELD_PARSERS, DEFAULT_LAP_CALCULATOR_FORM);
    expect(fieldErrors).toEqual({});
    expect(values?.currentTime).toEqual({ hours: 21, minutes: 5 });
    expect(values?.averageLapSeconds).toBe(120);
  });

  it('accetta orari con i secondi e rifiuta quelli vuoti', () => {
    expect(parseTime('07:30:15')).toEqual({ hours: 7, minutes: 30 });
    expect(parseTime('')).toBeNull();
  });

  it('restituisce un messaggio per ogni campo non valido', () => {
    const { values, fieldErrors } = parseFormFields(LAP_FIELD_PARSERS, {
      ...DEFAULT_LAP_CALCULATOR_FORM,
      averageLapSeconds: '0',
      currentTime: '',
      currentLobby: '0',
    });

    expect(values).toBeNull();
    expect(Object.keys(fieldErrors)).toEqual(['averageLapSeconds', 'currentTime', 'currentLobby']);
  });

  it('ignora un formato gara salvato che non esiste più', () => {
    const revivedForm = reviveStoredForm({ raceFormatId: '24h' }, DEFAULT_LAP_CALCULATOR_FORM, isAllowedLapCalculatorValue);
    expect(revivedForm?.raceFormatId).toBe(DEFAULT_LAP_CALCULATOR_FORM.raceFormatId);
  });
});
