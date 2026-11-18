import { useState } from 'react';
import tableStyles from '@/components/data-table/DataTable.module.css';
import { Button } from '@/components/ui/Button/Button';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { useI18n } from '@/i18n/useI18n';
import pageStyles from '../../pages/SitePage.module.css';
import { RaceReportViewer } from '../RaceReportViewer/RaceReportViewer';
import styles from './RaceDocuments.module.css';

type DocumentId = 'briefing' | 'qualifyingReport' | 'raceReport';

interface RaceDocument {
  readonly id: DocumentId;
  /** Indirizzo del PDF; null finché il documento non esiste ancora. */
  readonly url: string | null;
}

const VIEWER_PANEL_ID = 'race-document-viewer';

/**
 * Il browser sa mostrare un PDF dentro la pagina? Falso sui telefoni che non lo fanno (Android, per esempio)
 * e nei browser senza lettore PDF: lì resta solo lo scaricamento.
 */
const canShowPdfInline = () => typeof navigator !== 'undefined' && navigator.pdfViewerEnabled === true;

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
    </svg>
  );
}

interface RaceDocumentsProps {
  readonly raceTitle: string;
  readonly raceReportUrl: string;
}

/**
 * Scheda Documentazione: briefing pre-gara e referto di qualifica (non ancora disponibili) e referto di gara.
 * Accanto a ogni documento "Visualizza" e il pulsante con l'icona per scaricare il PDF. "Visualizza" divide lo spazio
 * con la stessa transizione di prima: l'elenco si stringe a sinistra e a destra compare il PDF; visualizzando un altro
 * documento, il suo PDF prende il posto di quello aperto.
 */
export function RaceDocuments({ raceTitle, raceReportUrl }: RaceDocumentsProps) {
  const { messages } = useI18n();
  const texts = messages.site.documents;
  const documents: readonly RaceDocument[] = [
    { id: 'briefing', url: null },
    { id: 'qualifyingReport', url: null },
    { id: 'raceReport', url: raceReportUrl },
  ];
  const [openDocumentId, setOpenDocumentId] = useState<DocumentId | null>(null);
  // Il PDF già aperto resta caricato finché non se ne apre un altro, così richiuderlo e riaprirlo è immediato.
  const [shownDocumentId, setShownDocumentId] = useState<DocumentId | null>(null);
  const [canView] = useState(canShowPdfInline);
  const shownDocument = documents.find((document) => document.id === shownDocumentId);

  return (
    <div className={pageStyles.reportLayout} data-report-open={openDocumentId !== null || undefined}>
      <div className={pageStyles.classificationPane}>
        <div className={tableStyles.tableScroller}>
          <table className={tableStyles.dataTable} aria-label={texts.tableLabel}>
            <thead>
              <tr>
                <th scope="col" className={tableStyles.plainColumnHeader}>
                  {texts.document}
                </th>
                <th scope="col" className={`${tableStyles.plainColumnHeader} ${styles.actionsHeader}`}>
                  {texts.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => {
                const name = texts[document.id];
                const isOpen = openDocumentId === document.id;
                return (
                  <tr key={document.id} className={tableStyles.dataRow} data-disabled={document.url === null || undefined}>
                    <td>
                      <span className={styles.name}>{name}</span>
                      {document.url === null && <span className={styles.status}>{texts.notAvailable}</span>}
                    </td>
                    <td>
                      <span className={styles.actions}>
                        {canView && (
                          <Button
                            variant="secondary"
                            disabled={document.url === null}
                            aria-expanded={isOpen}
                            aria-controls={VIEWER_PANEL_ID}
                            onClick={() => {
                              setOpenDocumentId(isOpen ? null : document.id);
                              if (!isOpen) setShownDocumentId(document.id);
                            }}
                          >
                            {isOpen ? texts.hide : texts.view}
                          </Button>
                        )}
                        {document.url === null ? (
                          <IconButton accessibleLabel={texts.download(name)} title={texts.download(name)} disabled>
                            <DownloadIcon />
                          </IconButton>
                        ) : (
                          // Il nome del file arriva dal server (Content-Disposition).
                          <a href={document.url} download className={styles.downloadLink} aria-label={texts.download(name)} title={texts.download(name)}>
                            <DownloadIcon />
                          </a>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {canView && (
        <div id={VIEWER_PANEL_ID} className={pageStyles.reportPane} inert={openDocumentId === null} aria-hidden={openDocumentId === null}>
          {shownDocument?.url && <RaceReportViewer key={shownDocument.id} url={shownDocument.url} title={`${texts[shownDocument.id]} – ${raceTitle}`} />}
        </div>
      )}
    </div>
  );
}
