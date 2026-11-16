import { type CSSProperties, useId } from 'react';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<OptionValue extends string> {
  readonly value: OptionValue;
  readonly label: string;
  readonly description?: string;
}

interface SegmentedControlProps<OptionValue extends string> {
  readonly legend: string;
  readonly options: readonly SegmentedOption<OptionValue>[];
  readonly selectedValue: OptionValue;
  readonly onSelect: (value: OptionValue) => void;
}

/** Gruppo di radio button presentato come selettore a segmenti. */
export function SegmentedControl<OptionValue extends string>({
  legend,
  options,
  selectedValue,
  onSelect,
}: SegmentedControlProps<OptionValue>) {
  const radioGroupName = useId();
  const optionCountStyle = { '--option-count': options.length } as CSSProperties;

  return (
    <fieldset className={styles.segmentedControl}>
      <legend className={styles.segmentedLegend}>{legend}</legend>
      <div className={styles.segmentedOptionList} style={optionCountStyle}>
        {options.map((option) => (
          <label key={option.value} className={styles.segmentedOption}>
            <input
              type="radio"
              className={styles.optionRadio}
              name={radioGroupName}
              value={option.value}
              checked={option.value === selectedValue}
              onChange={() => {
                onSelect(option.value);
              }}
            />
            <span className={styles.segmentedOptionLabel}>{option.label}</span>
            {option.description && <span className={styles.segmentedOptionDescription}>{option.description}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
