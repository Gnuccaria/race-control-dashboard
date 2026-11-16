/** Nome del sito: compare nell'header e nel titolo della scheda del browser. */
export const APP_NAME = 'Race Control Dashboard';

/** Titolo della scheda per una pagina interna, es. "Calcolatore di giri – Race Control Dashboard". */
export function formatDocumentTitle(pageName?: string): string {
  return pageName ? `${pageName} – ${APP_NAME}` : APP_NAME;
}
