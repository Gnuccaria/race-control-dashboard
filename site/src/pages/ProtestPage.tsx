import type { SiteProtest } from '@shared/protestRules';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { DiscordSignInButton } from '@/components/ui/DiscordSignInButton/DiscordSignInButton';
import { useI18n } from '@/i18n/useI18n';
import { fetchMyProtests, fetchProtestForm } from '../api/protests';
import { endExpiredSiteSession, getFreshSiteAccessToken, signInWithDiscord, useSiteAuth } from '../auth/siteAuthStore';
import { MyProtestList } from '../components/MyProtestList/MyProtestList';
import { ProtestForm, type ProtestFormState } from '../components/ProtestForm/ProtestForm';
import { PROTEST_PATH, protestPath } from '../sitePaths';
import styles from './HomePage.module.css';
import pageStyles from './SitePage.module.css';

/** Invia protesta: dopo l'accesso con Discord il modulo (equipaggio letto dal ruolo Discord) e, sotto, le proteste dell'equipaggio. */
export function Component() {
  const { messages } = useI18n();
  const siteTexts = messages.site;
  const auth = useSiteAuth();
  const navigate = useNavigate();
  const [formState, setFormState] = useState<ProtestFormState>({ status: 'loading' });
  const [protests, setProtests] = useState<readonly SiteProtest[] | null>(null);
  const userId = auth.status === 'signed-in' ? auth.profile.id : null;

  useEffect(() => {
    if (!userId) return;
    let isCurrent = true;
    void (async () => {
      const accessToken = await getFreshSiteAccessToken();
      const [result, mine] = accessToken ? await Promise.all([fetchProtestForm(accessToken), fetchMyProtests(accessToken)]) : [null, null];
      if (!isCurrent) return;
      setProtests(mine?.isSuccess ? mine.value : []);
      if (!result || (!result.isSuccess && result.problem === 'signed-out')) {
        endExpiredSiteSession();
        return;
      }
      if (result.isSuccess) setFormState({ status: 'ready', data: result.value });
      else {
        const { problem } = result;
        setFormState({
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
        name={siteTexts.cards.protest.name}
        description={siteTexts.protest.description}
        backLink={{ to: '/', label: siteTexts.backToHome }}
        documentTitle={siteTexts.documentTitle(siteTexts.cards.protest.name)}
      />
      {auth.status === 'checking' && <p role="status">{siteTexts.account.checking}</p>}
      {auth.status === 'signed-out' && (
        <div className={styles.signInReminder} role="status">
          <p>{auth.errorCode === 'invalid-grant' ? siteTexts.account.errors['invalid-grant'] : siteTexts.signInToUseTicketing}</p>
          <DiscordSignInButton onClick={() => void signInWithDiscord(PROTEST_PATH)}>{messages.auth.signInWithDiscord}</DiscordSignInButton>
        </div>
      )}
      {auth.status === 'signed-in' && (
        <>
          <ProtestForm
            formState={formState}
            onSent={(protestId, videoProblem) => {
              void navigate(`${protestPath(protestId)}?inviata=1${videoProblem ? `&video=${videoProblem}` : ''}`);
            }}
          />
          <MyProtestList protests={protests} />
        </>
      )}
    </div>
  );
}
