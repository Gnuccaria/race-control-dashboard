import { FieldGrid } from '@/components/form/FieldGrid/FieldGrid';
import type { FieldBinding } from '@/components/form/fieldBinding';
import { NumberField } from '@/components/form/NumberField/NumberField';
import { Panel } from '@/components/ui/Panel/Panel';
import { useI18n } from '@/i18n/useI18n';

interface CarValuesPanelProps {
  readonly bopWeightField: FieldBinding;
  readonly actualWeightField: FieldBinding;
  readonly bopPowerField: FieldBinding;
  readonly actualPowerField: FieldBinding;
}

/** Peso e potenza: quelli previsti dal BoP accanto a quelli effettivi dell'auto. */
export function CarValuesPanel({ bopWeightField, actualWeightField, bopPowerField, actualPowerField }: CarValuesPanelProps) {
  const { messages } = useI18n();
  const bopDeficitTexts = messages.bopDeficit;

  return (
    <Panel title={bopDeficitTexts.carTitle} description={bopDeficitTexts.carDescription}>
      <FieldGrid>
        <NumberField label={bopDeficitTexts.bopWeight} unit="kg" step={0.1} field={bopWeightField} />
        <NumberField label={bopDeficitTexts.actualWeight} unit="kg" step={0.1} field={actualWeightField} />
      </FieldGrid>
      <FieldGrid>
        <NumberField label={bopDeficitTexts.bopPower} unit="PS" step={0.1} field={bopPowerField} />
        <NumberField label={bopDeficitTexts.actualPower} unit="PS" step={0.1} field={actualPowerField} />
      </FieldGrid>
    </Panel>
  );
}
