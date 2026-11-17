import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { DiscordSignInButton } from '@/components/ui/DiscordSignInButton/DiscordSignInButton';
import { useI18n } from '@/i18n/useI18n';
import { fetchMyTicketCrew } from '../api/disconnectionTickets';
import { endExpiredSiteSession, getFreshSiteAccessToken, signInWithDiscord, useSiteAuth } from '../auth/siteAuthStore';
import { DisconnectionTicketForm, type TicketCrewState } from '../components/DisconnectionTicketForm/DisconnectionTicketForm';
import { MyTicketList } from '../components/MyTicketList/MyTicketList';
import { DISCONNECTION_TICKET_PATH, disconnectionTicketPath } from '../sitePaths';
import { refreshSiteTickets } from '../tickets/siteTicketStore';
import { useTicketAvailability } from '../tickets/useTicketAvailability';
import styles from './HomePage.module.css';
import pageStyles from './SitePage.module.css';

/**
 * Crea ticket di disconnessione: dopo l'accesso con Discord il modulo (equipaggio letto dal ruolo Discord) e,
 * sotto, i ticket già mandati con il loro stato. Con l'invio chiuso dalla Direzione Gara il modulo non c'è
 * (lo dice un avviso), ma i ticket già mandati restano visibili.
 */
export function Component() {
  const { messages } = useI18n();
  const siteTexts = messages.site;
  const auth = useSiteAuth();
  const navigate = useNavigate();
  const [crewState, setCrewState] = useState<TicketCrewState>({ status: 'loading' });
  const userId = auth.status === 'signed-in' ? auth.profile.id : null;
  const areTicketsOpen = useTicketAvailability();

  useEffect(() => {
    if (!userId) return;
    let isCurrent = true;
    void (async () => {
      const accessToken = await getFreshSiteAccessToken();
      const result = accessToken ? await fetchMyTicketCrew(accessToken) : null;
      if (!isCurrent) return;
      if (!result || (!result.isSuccess && result.problem === 'signed-out')) {
        endExpiredSiteSession();
        return;
      }
      if (result.isSuccess) setCrewState({ status: 'ready', crew: result.value });
      else {
        const { problem } = result;
        setCrewState({
          status: 'problem',
          problem: problem === 'no-crew-role' || problem === 'multiple-crew-roles' || problem === 'crew-not-found' || problem === 'bot-unavailable'
            ? problem
            : // 404: il server online non conosce ancora questa richiesta (non è stato ripubblicato).
              problem === 'not-found'
              ? 'server-outdated'
              : 'unavailable',
        });
      }
    })();
    return () => {
      isCurrent = false;
    };
  }, [userId]);

  return (
    <div className={pageStyles.sitePage}>
      <ToolPageHeader
        name={siteTexts.cards.disconnectionTicket.name}
        description={siteTexts.disconnectionTicket.description}
        backLink={{ to: '/', label: siteTexts.backToHome }}
        documentTitle={siteTexts.documentTitle(siteTexts.cards.disconnectionTicket.name)}
      />
      {auth.status === 'checking' && <p role="status">{siteTexts.account.checking}</p>}
      {auth.status === 'signed-out' && (
        <div className={styles.signInReminder} role="status">
          <p>{auth.errorCode === 'invalid-grant' ? siteTexts.account.errors['invalid-grant'] : siteTexts.signInToUseTicketing}</p>
          <DiscordSignInButton onClick={() => void signInWithDiscord(DISCONNECTION_TICKET_PATH)}>{messages.auth.signInWithDiscord}</DiscordSignInButton>
        </div>
      )}
      {auth.status === 'signed-in' && (
        <>
          {areTicketsOpen === false ? (
            <InlineAlert>{siteTexts.disconnectionTicket.closedNotice}</InlineAlert>
          ) : (
            <DisconnectionTicketForm
              crewState={crewState}
              onSent={(ticketId) => {
                void refreshSiteTickets(auth.profile.id);
                void navigate(`${disconnectionTicketPath(ticketId)}?inviato=1`);
              }}
            />
          )}
          <MyTicketList userId={auth.profile.id} />
        </>
      )}
    </div>
  );
}
