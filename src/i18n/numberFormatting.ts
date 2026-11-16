import { LOCALE_FORMATTING_TAGS, type Locale } from './locales';

export interface NumberFormatters {
  /** Al massimo tre decimali, con il separatore della lingua: 190,403 · 190.403. */
  readonly formatDecimal: (value: number) => string;
  /** Segno esplicito per differenze e scostamenti: "+10", "−5", "0". */
  readonly formatSignedDecimal: (value: number) => string;
  /** Separatore dei decimali della lingua: "," (italiano, francese, tedesco) o "." (inglese). */
  readonly decimalSeparator: string;
}

const formattersByLocale = new Map<Locale, NumberFormatters>();

function createNumberFormatters(locale: Locale): NumberFormatters {
  const decimalFormat = new Intl.NumberFormat(LOCALE_FORMATTING_TAGS[locale], { maximumFractionDigits: 3 });
  const formatDecimal = (value: number) => decimalFormat.format(value);

  return {
    formatDecimal,
    decimalSeparator: decimalFormat.formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? '.',
    formatSignedDecimal: (value) => {
      if (value === 0) return formatDecimal(0);
      return `${value > 0 ? '+' : '−'}${formatDecimal(Math.abs(value))}`;
    },
  };
}

/** I formattatori Intl sono costosi da creare: uno per lingua, riutilizzato. */
export function getNumberFormatters(locale: Locale): NumberFormatters {
  const cachedFormatters = formattersByLocale.get(locale);
  if (cachedFormatters) return cachedFormatters;

  const localeFormatters = createNumberFormatters(locale);
  formattersByLocale.set(locale, localeFormatters);
  return localeFormatters;
}
