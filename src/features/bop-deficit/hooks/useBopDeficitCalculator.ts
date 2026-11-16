import { usePersistentForm } from '@/hooks/usePersistentForm';
import { BOP_DEFICIT_FIELD_PARSERS, DEFAULT_BOP_DEFICIT_FORM } from '../form/bopDeficitForm';
import { computeBopDeficit } from '../model/bopDeficit';

const FORM_STORAGE_KEY = 'tools:bop-deficit:form:v1';

export function useBopDeficitCalculator() {
  const { values, bindField } = usePersistentForm({
    storageKey: FORM_STORAGE_KEY,
    defaultForm: DEFAULT_BOP_DEFICIT_FORM,
    fieldParsers: BOP_DEFICIT_FIELD_PARSERS,
  });

  return {
    bindField,
    bopDeficit: values ? computeBopDeficit(values) : null,
    completedLaps: values?.completedLaps ?? 0,
    totalLaps: values?.totalLaps ?? 0,
  };
}
