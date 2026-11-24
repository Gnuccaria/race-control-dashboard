import type { SiteProtest } from '@shared/protestRules';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { DefinitionList } from '@/components/ui/DefinitionList/DefinitionList';
import { DiscordSignInButton } from '@/components/ui/DiscordSignInButton/DiscordSignInButton';
import { Panel } from '@/components/ui/Panel/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge/StatusBadge';
import { useI18n } from '@/i18n/useI18n';
import { fetchMyProtest, type VideoUploadProblem } from '../api/protests';
import { endExpiredSiteSession, getFreshSiteAccessToken, signInWithDiscord, useSiteAuth } from '../auth/siteAuthStore';
import { protestRaceLabel } from '@/features/protests/protestRaceLabel';
import { protestStatusTone } from '@/features/protests/protestStatus';
import { FadingNotice } from '../components/FadingNotice/FadingNotice';
import { ProtestVideoSection } from '../components/ProtestVideoSection/ProtestVideoSection';
import { PROTEST_PATH, protestPath } from '../sitePaths';
import homeStyles from './HomePage.module.css';
import pageStyles from './SitePage.module.css';
import styles from './ProtestDetailPage.module.css';

const VIDEO_PROBLEMS: readonly VideoUploadProblem[] = ['too-large', 'invalid-type', 'expired', 'already-added', 'storage-unavailable', 'unavailable'];

/**
 * Pagina di una protesta per chi l'ha mandata e il suo equipaggio: i dati inviati, l'esito (in esame o respinta,
 * con la motivazione dei Commissari) e i video; entro 24 ore dall'invio chi l'ha mandata può aggiungere i video.
 */
export function Component() {
  const { messages, locale } = useI18n();
  const siteTexts = messages.site;
  const texts = siteTexts.protestDetail;
  const auth = useSiteAuth();
  const { protestId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadedResult, setProtest] = useState<SiteProtest | 'missing' | null>(null);
  // Un indirizzo con un numero non valido non si chiede nemmeno al server: la protesta non esiste.
  const isValidProtestId = /^\d{1,9}$/.test(protestId);
  const protest = isValidProtestId ? loadedResult : 'missing';
  const userId = auth.status === 'signed-in' ? auth.profile.id : null;
  const videoParam = searchParams.get('video');
  const [initialVideoProblem] = useState(() => VIDEO_PROBLEMS.find((problem) => problem === videoParam) ?? null);

  /** Legge la protesta dal server; null se non c'è niente da mostrare (numero non valido o sessione scaduta). */
  const readProtest = useCallback(async (): Promise<SiteProtest | 'missing' | null> => {
    if (!/^\d{1,9}$/.test(protestId)) return null;
    const accessToken = await getFreshSiteAccessToken();
    const result = accessToken ? await fetchMyProtest(accessToken, Number(protestId)) : null;
    if (!result || (!result.isSuccess && result.problem === 'signed-out')) {
      endExpiredSiteSession();
      return null;
    }
    return result.isSuccess ? result.value : 'missing';
  }, [protestId]);

  const reload = () => {
    void readProtest().then((nextProtest) => {
      if (nextProtest) setProtest(nextProtest);
    });
  };

  useEffect(() => {
    if (!userId) return;
    let isCurrent = true;
    void readProtest().then((nextProtest) => {
      if (isCurrent && nextProtest) setProtest(nextProtest);
    });
    return () => {
      isCurrent = false;
    };
  }, [userId, readProtest]);

  const formatDateTime = (isoTimestamp: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(isoTimestamp));
  const loadedProtest = protest !== null && protest !== 'missing' ? protest : null;
  const crewLabel = (crew: { readonly number: number; readonly name: string }) => `#${crew.number} ${crew.name}`;

  return (
    <div className={pageStyles.sitePage}>
      <ToolPageHeader
        name={loadedProtest ? texts.title(loadedProtest.id) : siteTexts.cards.protest.name}
        description={texts.description}
        backLink={{ to: PROTEST_PATH, label: siteTexts.cards.protest.name }}
        documentTitle={siteTexts.documentTitle(loadedProtest ? texts.title(loadedProtest.id) : siteTexts.cards.protest.name)}
      />
      {auth.status === 'checking' && <p role="status">{siteTexts.account.checking}</p>}
      {auth.status === 'signed-out' && (
        <div className={homeStyles.signInReminder} role="status">
          <p>{texts.signInToSee}</p>
          <DiscordSignInButton onClick={() => void signInWithDiscord(protestPath(Number(protestId) || 0))}>{messages.auth.signInWithDiscord}</DiscordSignInButton>
        </div>
      )}
      {auth.status === 'signed-in' && protest === null && <p role="status">{siteTexts.loading}</p>}
      {auth.status === 'signed-in' && protest === 'missing' && <EmptyState title={texts.notFound} description={texts.notFoundDescription} />}
      {auth.status === 'signed-in' && loadedProtest && (
        <>
          {searchParams.get('inviata') === '1' && (
            <FadingNotice onDone={() => setSearchParams({}, { replace: true })}>{texts.sent(loadedProtest.id)}</FadingNotice>
          )}
          <Panel title={texts.dataTitle} description={formatDateTime(loadedProtest.createdAt)}>
            <DefinitionList
              items={[
                {
                  term: texts.status,
                  description: (
                    <StatusBadge tone={protestStatusTone(loadedProtest.status)} label={siteTexts.myProtests.statuses[loadedProtest.status]} />
                  ),
                },
                ...(loadedProtest.race ? [{ term: siteTexts.protest.form.race, description: protestRaceLabel(loadedProtest, messages) }] : []),
                { term: siteTexts.disconnectionTicket.form.crew, description: crewLabel(loadedProtest.crew) },
                { term: siteTexts.myTickets.sentBy, description: `${loadedProtest.submittedByName} (@${loadedProtest.submittedByUsername})` },
                { term: siteTexts.protest.form.session, description: siteTexts.protest.form.sessions[loadedProtest.session] },
                ...(loadedProtest.stint === null ? [] : [{ term: siteTexts.protest.form.stint, description: loadedProtest.stint }]),
                { term: siteTexts.protest.form.lap, description: loadedProtest.lap },
                { term: siteTexts.protest.form.corner, description: loadedProtest.corner },
                {
                  term: siteTexts.protest.form.otherCrews,
                  description: loadedProtest.otherCrews.length === 0 ? texts.noOtherCrews : loadedProtest.otherCrews.map(crewLabel).join(', '),
                },
              ]}
            />
          </Panel>
          <Panel title={siteTexts.protest.form.descriptionLabel}>
            <p className={loadedProtest.description ? styles.description : styles.missingText}>{loadedProtest.description || texts.noDescription}</p>
          </Panel>
          <ProtestVideoSection protest={loadedProtest} initialVideoProblem={initialVideoProblem} onChanged={reload} />
        </>
      )}
    </div>
  );
}
