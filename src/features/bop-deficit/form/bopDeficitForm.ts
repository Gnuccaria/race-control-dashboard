import type { FieldParser } from '@/lib/form/parseFormFields';
import { parseNumberAtLeast } from '@/lib/numberParsing';

export interface BopDeficitForm extends Record<string, string> {
  readonly bopWeightKg: string;
  readonly actualWeightKg: string;
  readonly bopPowerPs: string;
  readonly actualPowerPs: string;
  readonly completedLaps: string;
  readonly totalLaps: string;
}

/** Il foglio originale parte vuoto: un campo vuoto vale 0, come una cella vuota. */
export const DEFAULT_BOP_DEFICIT_FORM: BopDeficitForm = {
  bopWeightKg: '',
  actualWeightKg: '',
  bopPowerPs: '',
  actualPowerPs: '',
  completedLaps: '',
  totalLaps: '',
};

const parseNonNegativeNumber = parseNumberAtLeast(0);

export const BOP_DEFICIT_FIELD_PARSERS = {
  bopWeightKg: { parse: parseNonNegativeNumber, errorKey: 'weightNonNegative' },
  actualWeightKg: { parse: parseNonNegativeNumber, errorKey: 'weightNonNegative' },
  bopPowerPs: { parse: parseNonNegativeNumber, errorKey: 'powerNonNegative' },
  actualPowerPs: { parse: parseNonNegativeNumber, errorKey: 'powerNonNegative' },
  completedLaps: { parse: parseNonNegativeNumber, errorKey: 'lapsNonNegative' },
  totalLaps: { parse: parseNonNegativeNumber, errorKey: 'lapsNonNegative' },
} satisfies Record<string, FieldParser<unknown>>;
