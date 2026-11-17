import { type ComponentType, useId, useState } from 'react';
import { Link, type LoaderFunctionArgs, redirect } from 'react-router';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { DiscordSignInButton } from '@/components/ui/DiscordSignInButton/DiscordSignInButton';
import cardStyles from '@/features/home/components/ToolCard/ToolCard.module.css';
import { ToolCardContent } from '@/features/home/components/ToolCard/ToolCardContent';
import sectionStyles from '@/features/home/components/ToolSectionList/ToolSectionList.module.css';
import { FieDisconnectionsIcon } from '@/features/fie-disconnections/FieDisconnectionsIcon';
import { LapCalculatorIcon } from '@/features/lap-calculator/LapCalculatorIcon';
import { RaceResultsIcon } from '@/features/race-results/RaceResultsIcon';
import { useI18n } from '@/i18n/useI18n';
import { signInWithDiscord, useSiteAuth } from '../auth/siteAuthStore';
import { ProtestIcon } from '@/features/protests/ProtestIcon';
import { DISCONNECTION_TICKET_PATH, PROTEST_PATH, RACES_PATH } from '../sitePaths';
import { useTicketAvailability } from '../tickets/useTicketAvailability';
import styles from './HomePage.module.css';
import pageStyles from './SitePage.module.css';

/** I vecchi indirizzi dell'elenco gare con i filtri (/?pista=12) portano alla nuova pagina delle gare. */
export function loader({ request }: LoaderFunctionArgs) {
  const { search } = new URL(request.url);
  return search ? redirect(`${RACES_PATH}${search}`) : null;
}

interface CardTexts {
  readonly name: string;
  readonly description: string;
}

/**
 * Home del sito, divisa in sezioni come l'app.
 * - Sessioni di gara: Sessione di qualifica (in costruzione) e Sessioni di gara (l'elenco delle gare), per tutti.
 * - Ticketing: Invia ticket di disconnessione e Invia protesta, solo dopo l'accesso con Discord. Prima
 *   dell'accesso queste card non si aprono: ricordano di accedere e offrono il pulsante di Discord.
 *   La card dei ticket si apre solo se la Direzione Gara ha aperto l'invio (interruttore nel Calcolatore
 *   disconnessioni); con l'invio chiuso è disattivata e lo dice.
 */
export function Component() {
  const { messages } = useI18n();
  const siteTexts = messages.site;
  const cardTexts = siteTexts.cards;
  const auth = useSiteAuth();
  // Card con l'accesso richiesto appena cliccata: dopo l'accesso si torna lì.
  const [lockedPath, setLockedPath] = useState<string | null>(null);
  const reminderId = useId();
  const isSignedIn = auth.status === 'signed-in';
  const areTicketsOpen = useTicketAvailability();

  const signedInCard = (path: string, Icon: ComponentType, texts: CardTexts) =>
    isSignedIn ? (
      <Link to={path} className={cardStyles.toolCard}>
        <ToolCardContent Icon={Icon} name={texts.name} description={texts.description} />
      </Link>
    ) : (
      // Non è un link: il clic mostra solo il promemoria per accedere.
      <button
        type="button"
        className={`${cardStyles.toolCard} ${styles.lockedCard}`}
        aria-describedby={lockedPath === path ? reminderId : undefined}
        onClick={() => {
          setLockedPath(path);
        }}
      >
        <ToolCardContent Icon={Icon} name={texts.name} description={texts.description} statusLabel={siteTexts.signInRequired} />
      </button>
    );

  return (
    <div className={pageStyles.sitePage}>
      <ToolPageHeader
        name={siteTexts.homeTitle}
        description={siteTexts.homeDescription}
        backLink={null}
        documentTitle={siteTexts.documentTitle(siteTexts.homeTitle)}
      />
      <div className={sectionStyles.toolSectionList}>
        <section className={sectionStyles.toolSection} aria-labelledby="home-race-sessions">
          <h2 id="home-race-sessions" className={sectionStyles.sectionTitle}>
            {siteTexts.sections.raceSessions}
          </h2>
          <ul className={sectionStyles.toolCardList}>
            <li className={sectionStyles.toolCardItem}>
              <div className={cardStyles.toolCard} aria-disabled="true" data-under-construction>
                <ToolCardContent
                  Icon={LapCalculatorIcon}
                  name={cardTexts.qualifying.name}
                  description={cardTexts.qualifying.description}
                  statusLabel={messages.home.underConstruction}
                />
              </div>
            </li>
            <li className={sectionStyles.toolCardItem}>
              <Link to={RACES_PATH} className={cardStyles.toolCard}>
                <ToolCardContent Icon={RaceResultsIcon} name={cardTexts.races.name} description={cardTexts.races.description} />
              </Link>
            </li>
          </ul>
        </section>

        <section className={sectionStyles.toolSection} aria-labelledby="home-ticketing">
          <h2 id="home-ticketing" className={sectionStyles.sectionTitle}>
            {siteTexts.sections.ticketing}
          </h2>
          <ul className={sectionStyles.toolCardList}>
            <li className={sectionStyles.toolCardItem}>
              {areTicketsOpen === false ? (
                <div className={cardStyles.toolCard} aria-disabled="true" data-under-construction>
                  <ToolCardContent
                    Icon={FieDisconnectionsIcon}
                    name={cardTexts.disconnectionTicket.name}
                    description={siteTexts.disconnectionTicket.closedNotice}
                    statusLabel={siteTexts.disconnectionTicket.closedLabel}
                  />
                </div>
              ) : (
                signedInCard(DISCONNECTION_TICKET_PATH, FieDisconnectionsIcon, cardTexts.disconnectionTicket)
              )}
            </li>
            <li className={sectionStyles.toolCardItem}>{signedInCard(PROTEST_PATH, ProtestIcon, cardTexts.protest)}</li>
          </ul>
          {!isSignedIn && lockedPath !== null && (
            <div id={reminderId} className={styles.signInReminder} role="status">
              <p>{siteTexts.signInToUseTicketing}</p>
              <DiscordSignInButton disabled={auth.status === 'checking'} onClick={() => void signInWithDiscord(lockedPath)}>
                {messages.auth.signInWithDiscord}
              </DiscordSignInButton>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
