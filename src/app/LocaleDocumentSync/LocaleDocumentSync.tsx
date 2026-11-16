import { useEffect } from 'react';
import { useLocale } from '@/i18n/useI18n';

/**
 * Allinea l'attributo lang di <html> alla lingua corrente: serve agli screen reader
 * per la pronuncia e al browser per sillabazione e controllo ortografico.
 */
export function LocaleDocumentSync() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
