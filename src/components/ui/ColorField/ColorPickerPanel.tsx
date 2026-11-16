import { FormField } from '@/components/form/FormField/FormField';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import type { HsvColor } from '@/lib/color/colorConversion';
import { COLOR_PALETTE_ROWS } from '@/lib/color/colorPalette';
import { useI18n } from '@/i18n/useI18n';
import styles from './ColorField.module.css';
import { useColorDraft } from './useColorDraft';

interface ColorPickerPanelProps {
  readonly initialHex: string | null;
  readonly onConfirm: (hexColor: string) => void;
  /** Assente nei campi obbligatori: il pulsante "Togli colore" non compare. */
  readonly onRemove?: (() => void) | undefined;
  readonly onCancel: () => void;
}

const HSV_LIMITS: Record<keyof HsvColor, number> = { hue: 360, saturation: 100, value: 100 };

/**
 * Contenuto del popup: a sinistra la tabella colori, a destra anteprima, esadecimale e HSV.
 * Viene montato a ogni apertura, quindi parte sempre dal colore attuale del campo.
 */
export function ColorPickerPanel({ initialHex, onConfirm, onRemove, onCancel }: ColorPickerPanelProps) {
  const { messages } = useI18n();
  const pickerTexts = messages.colorPicker;
  const colorDraft = useColorDraft(initialHex);
  const hsvLabels: Record<keyof HsvColor, string> = {
    hue: pickerTexts.hueLabel,
    saturation: pickerTexts.saturationLabel,
    value: pickerTexts.valueLabel,
  };

  // Con un esadecimale incompleto nel campo non si conferma: si confermerebbe un colore diverso da quello scritto.
  const canConfirm = colorDraft.selectedHex !== null && !colorDraft.isHexInvalid;
  const confirmSelection = () => {
    if (canConfirm && colorDraft.selectedHex) onConfirm(colorDraft.selectedHex);
  };

  return (
    <div
      className={styles.pickerPanel}
      onKeyDown={(keyboardEvent) => {
        // Il popup sta dentro un form: Invio in un campo conferma il colore invece di inviare il form.
        if (keyboardEvent.key === 'Enter' && keyboardEvent.target instanceof HTMLInputElement) {
          keyboardEvent.preventDefault();
          confirmSelection();
        }
      }}
    >
      <div className={styles.pickerBody}>
        <div role="group" aria-label={pickerTexts.paletteLabel} className={styles.palette}>
          {COLOR_PALETTE_ROWS.flat().map((paletteColor) => (
            <button
              key={paletteColor}
              type="button"
              className={styles.paletteSwatch}
              style={{ backgroundColor: paletteColor }}
              aria-label={paletteColor}
              aria-pressed={colorDraft.selectedHex === paletteColor}
              onClick={() => {
                colorDraft.pickColor(paletteColor);
              }}
            />
          ))}
        </div>

        <fieldset className={styles.customColor}>
          <legend className={styles.customColorLegend}>{pickerTexts.customColorLegend}</legend>
          <div
            className={styles.colorPreview}
            role="img"
            aria-label={`${pickerTexts.previewLabel}: ${colorDraft.selectedHex ?? pickerTexts.noColorSelected}`}
            style={colorDraft.selectedHex ? { backgroundColor: colorDraft.selectedHex } : undefined}
            data-empty={colorDraft.selectedHex ? undefined : true}
          />
          <FormField
            label={pickerTexts.hexLabel}
            errorMessage={colorDraft.isHexInvalid ? pickerTexts.invalidHex : undefined}
          >
            {({ isInvalid, ...inputAttributes }) => (
              <Input
                {...inputAttributes}
                type="text"
                maxLength={7}
                spellCheck={false}
                placeholder="#E10600"
                isInvalid={isInvalid}
                value={colorDraft.hexText}
                onValueChange={colorDraft.changeHexText}
              />
            )}
          </FormField>
          <div className={styles.hsvFields}>
            {(['hue', 'saturation', 'value'] as const).map((component) => (
              <FormField key={component} label={hsvLabels[component]}>
                {({ isInvalid, ...inputAttributes }) => (
                  <Input
                    {...inputAttributes}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={HSV_LIMITS[component]}
                    step={1}
                    isInvalid={isInvalid}
                    value={colorDraft.hsvTexts[component]}
                    onValueChange={(componentText) => {
                      colorDraft.changeHsvText(component, componentText);
                    }}
                  />
                )}
              </FormField>
            ))}
          </div>
        </fieldset>
      </div>

      <div className={styles.pickerActions}>
        {initialHex && onRemove && (
          <Button variant="quiet" className={styles.removeColorButton} onClick={onRemove}>
            {pickerTexts.removeColor}
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          {pickerTexts.cancel}
        </Button>
        <Button variant="confirm" disabled={!canConfirm} onClick={confirmSelection}>
          {pickerTexts.confirm}
        </Button>
      </div>
    </div>
  );
}
