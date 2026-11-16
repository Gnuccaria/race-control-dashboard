import { useI18n } from '@/i18n/useI18n';
import styles from './RaceReportViewer.module.css';

interface RaceReportViewerProps {
  readonly url: string;
  /** Nome del riquadro per i lettori di schermo. */
  readonly title: string;
}

/**
 * Referto in PDF mostrato dentro la pagina dal visualizzatore del browser. Dove i PDF non si possono mostrare
 * in pagina (molti telefoni) compare al loro posto il link per aprirlo.
 */
export function RaceReportViewer({ url, title }: RaceReportViewerProps) {
  const { messages } = useI18n();
  const texts = messages.site.classification;
  return (
    <object data={`${url}#view=FitH`} type="application/pdf" aria-label={title} className={styles.reportViewer}>
      <div className={styles.fallback}>
        <p>{texts.reportFallback}</p>
        <a href={url} target="_blank" rel="noreferrer">
          {texts.openReport}
        </a>
      </div>
    </object>
  );
}
