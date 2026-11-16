import { useState } from 'react';
import { clampHsv, type HsvColor, hexToHsv, hsvToHex, parseHexColor } from '@/lib/color/colorConversion';

type HsvTexts = Record<keyof HsvColor, string>;

const toHsvTexts = (hsvColor: HsvColor): HsvTexts => ({
  hue: String(hsvColor.hue),
  saturation: String(hsvColor.saturation),
  value: String(hsvColor.value),
});

const EMPTY_HSV_TEXTS: HsvTexts = { hue: '', saturation: '', value: '' };

interface ColorDraft {
  /** Colore valido scelto finora nel popup; null = ancora nessuno. */
  readonly selectedHex: string | null;
  /** Testi così come sono nei campi, anche a metà digitazione. */
  readonly hexText: string;
  readonly hsvTexts: HsvTexts;
}

/**
 * Stato del popup: tabella colori, esadecimale e HSV restano sincronizzati.
 * Il campo che l'utente sta scrivendo non viene mai riscritto sotto le sue dita:
 * si aggiornano solo gli altri, e solo quando il valore digitato è valido.
 */
export function useColorDraft(initialHex: string | null) {
  const [draft, setDraft] = useState<ColorDraft>(() => ({
    selectedHex: initialHex,
    hexText: initialHex ?? '',
    hsvTexts: initialHex ? toHsvTexts(hexToHsv(initialHex)) : EMPTY_HSV_TEXTS,
  }));

  const isHexInvalid = draft.hexText.trim() !== '' && parseHexColor(draft.hexText) === null;

  return {
    ...draft,
    isHexInvalid,
    /** Clic su un colore della tabella. */
    pickColor: (hexColor: string) => {
      setDraft({ selectedHex: hexColor, hexText: hexColor, hsvTexts: toHsvTexts(hexToHsv(hexColor)) });
    },
    changeHexText: (hexText: string) => {
      const parsedHex = parseHexColor(hexText);
      setDraft((previousDraft) =>
        parsedHex
          ? { selectedHex: parsedHex, hexText, hsvTexts: toHsvTexts(hexToHsv(parsedHex)) }
          : { ...previousDraft, hexText },
      );
    },
    changeHsvText: (component: keyof HsvColor, componentText: string) => {
      setDraft((previousDraft) => {
        const hsvTexts = { ...previousDraft.hsvTexts, [component]: componentText };
        const hsvNumbers = [hsvTexts.hue, hsvTexts.saturation, hsvTexts.value].map((text) =>
          text.trim() === '' ? Number.NaN : Number(text),
        );
        if (hsvNumbers.some((number) => !Number.isFinite(number))) return { ...previousDraft, hsvTexts };

        const [hue = 0, saturation = 0, value = 0] = hsvNumbers;
        const selectedHex = hsvToHex(clampHsv({ hue, saturation, value }));
        return { selectedHex, hexText: selectedHex, hsvTexts };
      });
    },
  };
}
