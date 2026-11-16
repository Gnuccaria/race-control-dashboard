import { usePersistentForm } from '@/hooks/usePersistentForm';
import { DEFAULT_LAP_CALCULATOR_FORM, isAllowedLapCalculatorValue, LAP_FIELD_PARSERS } from '../form/formState';
import { computeLapPlan } from '../model/lapPlan';
import { buildResultView } from '../model/presentation';
import { getRaceFormat, getStintCount, type RaceFormatId } from '../model/raceFormats';

const FORM_STORAGE_KEY = 'tools:lap-calculator:form:v2';

/** Stato dello strumento: tutto ciò che è calcolabile viene derivato durante il render. */
export function useLapCalculator() {
  const { form, values, updateField, bindField } = usePersistentForm({
    storageKey: FORM_STORAGE_KEY,
    defaultForm: DEFAULT_LAP_CALCULATOR_FORM,
    fieldParsers: LAP_FIELD_PARSERS,
    isAllowedValue: isAllowedLapCalculatorValue,
  });

  const raceFormat = getRaceFormat(form.raceFormatId);
  const result = values ? buildResultView(computeLapPlan({ raceFormat, ...values })) : null;

  const selectRaceFormat = (raceFormatId: RaceFormatId) => {
    updateField('raceFormatId', raceFormatId);
  };

  return {
    raceFormatId: form.raceFormatId,
    selectRaceFormat,
    stintCount: getStintCount(raceFormat),
    bindField,
    result,
  };
}
