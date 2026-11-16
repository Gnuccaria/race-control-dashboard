import { describe, expect, it } from 'vitest';
import { parseNumberAtLeast, parsePositiveNumber } from '../numberParsing';
import { type FieldParserSchema, parseFormFields } from './parseFormFields';

const FIELD_PARSERS = {
  lapLength: { parse: parsePositiveNumber, errorKey: 'trackLengthPositive' },
  laps: { parse: parseNumberAtLeast(0), errorKey: 'lapsNonNegative' },
} satisfies FieldParserSchema;

describe('parseFormFields', () => {
  it('converte i campi validi, con virgola decimale e campo vuoto = 0', () => {
    expect(parseFormFields(FIELD_PARSERS, { lapLength: '5,807', laps: '' })).toEqual({
      values: { lapLength: 5.807, laps: 0 },
      fieldErrors: {},
    });
  });

  it('restituisce il messaggio di errore di ogni campo non valido e nessun valore', () => {
    expect(parseFormFields(FIELD_PARSERS, { lapLength: '0', laps: 'abc' })).toEqual({
      values: null,
      fieldErrors: { lapLength: 'trackLengthPositive', laps: 'lapsNonNegative' },
    });
  });
});
