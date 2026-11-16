import { isLeaderPosition, type SiteDisconnectionTicket } from '@shared/disconnectionTicketRules';
import { formatRaceTimestamp } from '@shared/driverSwapRules';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { EmptyState } from '@/components/data-table/ListStatus';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { DefinitionList } from '@/components/ui/DefinitionList/DefinitionList';
import { DiscordSignInButton } from '@/components/ui/DiscordSignInButton/DiscordSignInButton';
import { Panel } from '@/components/ui/Panel/Panel';
import { StatusBadge } from '@/components/ui/StatusBadge/StatusBadge';
import { useI18n } from '@/i18n/useI18n';
import { fetchMyTicket } from '../api/disconnectionTickets';
import { getFreshSiteAccessToken, signInWithDiscord, useSiteAuth } from '../auth/siteAuthStore';
import { FadingNotice } from '../components/FadingNotice/FadingNotice';
import { TicketResultView } from '../components/TicketResultView/TicketResultView';
import { DISCONNECTION_TICKET_PATH, disconnectionTicketPath } from '../sitePaths';
import { markResultsSeen, startSiteTicketPolling, useSiteTickets } from '../tickets/siteTicketStore';
import homeStyles from './HomePage.module.css';
import pageStyles from './SitePage.module.css';

/**
 * Dettaglio di un ticket mandato da chi è entrato: i dati inviati e, appena la Direzione Gara lo gestisce,
 * il risultato con il dettaglio del calcolo (si aggiorna da solo). Aprirlo segna come vista la sua notifica.
 */
export function Component() {
  const { messages, locale } = useI18n();
  const siteTexts = messages.site;
  const texts = siteTexts.ticketDetail;
  const formTexts = siteTexts.disconnectionTicket.form;
  const auth = useSiteAuth();
  const ticketId = Number(useParams().ticketId);
  const [searchParams, setSearchParams] = useSearchParams();
  const ticketState = useSiteTickets();
  const [loadedTicket, setLoadedTicket] = useState<SiteDisconnectionTicket | null | 'missing'>(null);
  const userId = auth.status === 'signed-in' ? auth.profile.id : null;

  useEffect(() => (userId ? startSiteTicketPolling(userId) : undefined), [userId]);

  // Il ticket arriva dall'elenco aggiornato ogni 30 secondi; se non c'è (ticket vecchio) si legge da solo.
  const listedTicket = ticketState.tickets.find((ticket) => ticket.id === ticketId) ?? null;
  useEffect(() => {
    if (!userId || listedTicket || ticketState.status !== 'ready') return;
    let isCurrent = true;
    void (async () => {
      const accessToken = await getFreshSiteAccessToken();
      const result = accessToken ? await fetchMyTicket(accessToken, ticketId) : null;
      if (isCurrent) setLoadedTicket(result?.isSuccess ? result.value : 'missing');
    })();
    return () => {
      isCurrent = false;
    };
  }, [userId, ticketId, listedTicket, ticketState.status]);
  const ticket = listedTicket ?? (loadedTicket === 'missing' ? null : loadedTicket);

  const isResolved = ticket?.status === 'resolved';
  useEffect(() => {
    if (isResolved) markResultsSeen([ticketId]);
  }, [isResolved, ticketId]);

  const formatDateTime = (isoText: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(isoText));

  return (
    <div className={pageStyles.sitePage}>
      <ToolPageHeader
        name={texts.title(ticketId)}
        description={texts.description}
        backLink={{ to: DISCONNECTION_TICKET_PATH, label: siteTexts.cards.disconnectionTicket.name }}
        documentTitle={siteTexts.documentTitle(texts.title(ticketId))}
      />
      {auth.status === 'checking' && <p role="status">{siteTexts.account.checking}</p>}
      {auth.status === 'signed-out' && (
        <div className={homeStyles.signInReminder} role="status">
          <p>{texts.signInToSee}</p>
          <DiscordSignInButton onClick={() => void signInWithDiscord(disconnectionTicketPath(ticketId))}>{messages.auth.signInWithDiscord}</DiscordSignInButton>
        </div>
      )}
      {auth.status === 'signed-in' && loadedTicket === 'missing' && !listedTicket && (
        <EmptyState title={texts.notFound} description={texts.notFoundDescription} />
      )}
      {auth.status === 'signed-in' && !ticket && loadedTicket !== 'missing' && <p role="status">{siteTexts.loading}</p>}
      {auth.status === 'signed-in' && ticket && (
        <>
          {searchParams.get('inviato') === '1' && (
            <FadingNotice onDone={() => setSearchParams({}, { replace: true })}>{texts.sent}</FadingNotice>
          )}
          <Panel title={texts.dataTitle} description={formatDateTime(ticket.createdAt)}>
            <DefinitionList
              items={[
                { term: formTexts.crew, description: `#${ticket.crewNumber} ${ticket.crewName}` },
                { term: siteTexts.myTickets.sentBy, description: `${ticket.submittedByName} (@${ticket.submittedByUsername})` },
                { term: formTexts.position, description: `P${ticket.position}` },
                {
                  term: isLeaderPosition(ticket.position) ? formTexts.gapFromSecond : formTexts.gapFromLeader,
                  description: formatRaceTimestamp(ticket.gapMs),
                },
                { term: formTexts.lap, description: String(ticket.disconnectedOnLap) },
                { term: texts.status, description: <StatusBadge tone={isResolved ? 'positive' : 'warning'} label={isResolved ? siteTexts.myTickets.resolved : siteTexts.myTickets.open} /> },
                ...(ticket.resolvedAt ? [{ term: texts.resolvedAt, description: formatDateTime(ticket.resolvedAt) }] : []),
              ]}
            />
          </Panel>
          {ticket.result ? (
            <section className={pageStyles.section} aria-label={texts.resultTitle}>
              <h2 className={pageStyles.sectionTitle}>{texts.resultTitle}</h2>
              <TicketResultView result={ticket.result} />
            </section>
          ) : (
            <p className={homeStyles.signInReminder} role="status">
              {texts.waiting}
            </p>
          )}
        </>
      )}
    </div>
  );
}
