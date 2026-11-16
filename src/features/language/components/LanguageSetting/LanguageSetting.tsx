import { useId, useSyncExternalStore } from 'react';
import { Select } from '@/components/ui/Select/Select';
import {
  getLanguagePreference,
  type LanguagePreference,
  setLanguagePreference,
  subscribeToLanguagePreference,
} from '@/i18n/languagePreferenceStore';
import { LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES } from '@/i18n/locales';
import { useI18n } from '@/i18n/useI18n';
import styles from './LanguageSetting.module.css';

/**
 * Scelta della lingua: quella automatica (le lingue preferite del sistema nell'app, del browser nel sito;
 * se nessuna è supportata, inglese) oppure una delle lingue supportate.
 */
export function LanguageSetting({ automaticLabel }: { readonly automaticLabel?: string | undefined }) {
  const { messages } = useI18n();
  const languagePreference = useSyncExternalStore(subscribeToLanguagePreference, getLanguagePreference);
  const selectId = useId();

  const languageOptions: { value: LanguagePreference; label: string }[] = [
    { value: 'system', label: automaticLabel ?? messages.userMenu.systemLanguage },
    ...SUPPORTED_LOCALES.map((locale) => ({ value: locale, label: LOCALE_NATIVE_NAMES[locale] })),
  ];

  return (
    <div className={styles.languageSetting}>
      <label htmlFor={selectId} className={styles.languageLabel}>
        {messages.userMenu.language}
      </label>
      <Select id={selectId} value={languagePreference} options={languageOptions} onValueChange={setLanguagePreference} />
    </div>
  );
}
