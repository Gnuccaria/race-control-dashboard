import { useParams } from 'react-router';
import { LoadError, LoadingStatus } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { DefinitionList } from '@/components/ui/DefinitionList/DefinitionList';
import { Panel } from '@/components/ui/Panel/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge/StatusBadge';
import { useServerQuery } from '@/hooks/useServerQuery';
import { useI18n } from '@/i18n/useI18n';
import { formatTimestamp } from '@/lib/dateFormatting';
import { crewLabel } from './crewLabel';
import { protestRaceLabel } from './protestRaceLabel';
import { protestStatusTone } from './protestStatus';
import { UploadedProtestVideo, YoutubeProtestVideo } from './ProtestVideo';
import { ProtestReviewPanel } from './ProtestReviewPanel';
import { protestStore } from './protestStore';
import styles from './Protests.module.css';
import { fetchProtest } from './services/protestApi';

const PROTEST_ID_PATTERN = /^\d{1,9}$/;

/** Dettaglio di una protesta (…/proteste/:protestId): tutti i dati inviati e i video nel player. */
export function ProtestDetailPage() {
  const { locale, messages } = useI18n();
  const texts = messages.protests;
  const { protestId = '' } = useParams();
  const isValidId = PROTEST_ID_PATTERN.test(protestId);
  const { queryState, reload, replaceValue } = useServerQuery(`protest-${protestId}`, async () =>
    isValidId ? fetchProtest(Number(protestId)) : ({ isSuccess: false, errorKind: 'not-found' } as const),
  );
  const protest = queryState.status === 'loaded' ? queryState.value : null;

  return (
    <div className={styles.protestsPage}>
      <ToolPageHeader
        name={protest ? texts.detail.title(protest.id) : messages.tools.manageProtests.name}
        description={protest ? texts.detail.subtitle(formatTimestamp(protest.createdAt, locale), protest.submittedByName, protest.submittedByUsername) : ''}
        backLink={{ to: '..', relative: 'path', label: texts.detail.backToList }}
      />
      {queryState.status === 'loading' && <LoadingStatus>{texts.detail.loading}</LoadingStatus>}
      {queryState.status === 'failed' && (
        <LoadError message={messages.serverErrors[queryState.errorKind]} retryLabel={messages.crews.list.retry} onRetry={reload} />
      )}
      {protest && (
        <>
          <Panel title={texts.detail.dataTitle}>
            <DefinitionList
              items={[
                {
                  term: texts.columns.status,
                  description: <StatusBadge tone={protestStatusTone(protest.status)} label={texts.statuses[protest.status]} />,
                },
                { term: texts.columns.crew, description: crewLabel(protest.crew) },
                ...(protest.race
                  ? [{ term: texts.columns.race, description: protestRaceLabel(protest, messages) }]
                  : protest.championship
                    ? [{ term: texts.detail.championship, description: protest.championship }]
                    : []),
                { term: texts.columns.stint, description: protest.stint },
                { term: texts.columns.lap, description: protest.lap },
                { term: texts.detail.corner, description: protest.corner },
                {
                  term: texts.columns.otherCrews,
                  description:
                    protest.otherCrews.length === 0 ? texts.noOtherCrews : protest.otherCrews.map((crew) => crewLabel(crew)).join(', '),
                },
                { term: texts.detail.sentBy, description: `${protest.submittedByName} (@${protest.submittedByUsername})` },
              ]}
            />
          </Panel>
          <Panel title={texts.detail.descriptionTitle}>
            {protest.description ? (
              <p className={styles.protestDescription}>{protest.description}</p>
            ) : (
              <p className={styles.missingText}>{texts.detail.noDescription}</p>
            )}
          </Panel>
          <Panel title={texts.detail.videoTitle}>
            {!protest.video && !protest.youtubeVideoId && <p className={styles.missingText}>{texts.detail.noVideo}</p>}
            <div className={styles.videos}>
              {protest.video && (
                <section className={styles.videoBlock} aria-label={texts.detail.uploadedVideo}>
                  <h3 className={styles.videoHeading}>{texts.detail.uploadedVideo}</h3>
                  {protest.video.isExpired ? (
                    <p className={styles.videoStatus}>{texts.detail.videoExpired}</p>
                  ) : (
                    <UploadedProtestVideo protestId={protest.id} size={protest.video.size} />
                  )}
                </section>
              )}
              {protest.youtubeVideoId && (
                <section className={styles.videoBlock} aria-label={texts.detail.youtubeVideo}>
                  <h3 className={styles.videoHeading}>{texts.detail.youtubeVideo}</h3>
                  <YoutubeProtestVideo videoId={protest.youtubeVideoId} />
                </section>
              )}
            </div>
          </Panel>
          <ProtestReviewPanel
            protest={protest}
            onSaved={(savedProtest) => {
              replaceValue(savedProtest);
              // La protesta respinta esce subito dalla campanella, senza aspettare la prossima lettura.
              void protestStore.refresh();
            }}
          />
        </>
      )}
    </div>
  );
}
