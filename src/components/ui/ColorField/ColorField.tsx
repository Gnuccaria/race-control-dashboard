import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@/i18n/useI18n';
import styles from './ColorField.module.css';
import { ColorPickerPanel } from './ColorPickerPanel';

interface ColorFieldProps {
  readonly id?: string;
  readonly 'aria-describedby'?: string | undefined;
  /** Esadecimale "#RRGGBB"; '' = nessun colore (cerchio trasparente). */
  readonly value: string;
  readonly onValueChange: (hexColor: string) => void;
  /** Nome per i form che leggono il FormData: il valore viaggia in un campo nascosto. */
  readonly name?: string;
  /** Sola lettura: il cerchio mostra il colore ma non apre il popup. */
  readonly disabled?: boolean;
  /** false per i campi obbligatori: il popup non offre "Togli colore". */
  readonly isRemovable?: boolean;
}

/**
 * Campo colore: un cerchio trasparente che, una volta scelto il colore, si riempie interamente.
 * Il clic apre un popup modale (dialog nativo: focus intrappolato, Esc per chiudere).
 */
export function ColorField({
  id,
  'aria-describedby': describedBy,
  value,
  onValueChange,
  name,
  disabled = false,
  isRemovable = true,
}: ColorFieldProps) {
  const { messages } = useI18n();
  const pickerTexts = messages.colorPicker;
  const dialogElementRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Sincronizza lo stato React con l'API imperativa del dialog nativo.
  useEffect(() => {
    const dialogElement = dialogElementRef.current;
    if (!dialogElement) return;
    if (isPickerOpen && !dialogElement.open) dialogElement.showModal();
    if (!isPickerOpen && dialogElement.open) dialogElement.close();
  }, [isPickerOpen]);

  const closePicker = () => {
    setIsPickerOpen(false);
  };

  return (
    <div className={styles.colorField}>
      <button
        id={id}
        type="button"
        className={styles.colorTrigger}
        style={value ? { backgroundColor: value } : undefined}
        data-empty={value ? undefined : true}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        aria-label={value ? pickerTexts.currentColor(value) : pickerTexts.openPicker}
        onClick={() => {
          setIsPickerOpen(true);
        }}
      />
      <span className={styles.colorValue} data-empty={value ? undefined : true}>
        {value || pickerTexts.noColorSelected}
      </span>
      {name !== undefined && <input type="hidden" name={name} value={value} />}

      <dialog
        ref={dialogElementRef}
        className={styles.pickerDialog}
        aria-labelledby={dialogTitleId}
        onCancel={(cancelEvent) => {
          cancelEvent.preventDefault();
          closePicker();
        }}
      >
        <h2 id={dialogTitleId} className={styles.pickerTitle}>
          {pickerTexts.title}
        </h2>
        {isPickerOpen && (
          <ColorPickerPanel
            initialHex={value || null}
            onConfirm={(hexColor) => {
              onValueChange(hexColor);
              closePicker();
            }}
            onRemove={
              isRemovable
                ? () => {
                    onValueChange('');
                    closePicker();
                  }
                : undefined
            }
            onCancel={closePicker}
          />
        )}
      </dialog>
    </div>
  );
}
