import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ToolPageHeader } from '@/components/layout/ToolPageHeader/ToolPageHeader';
import { DiscordSignInButton } from '@/components/ui/DiscordSignInButton/DiscordSignInButton';
import { useI18n } from '@/i18n/useI18n';
import { completeSignIn, type SignInCompletion, signInWithDiscord } from '../auth/siteAuthStore';
import pageStyles from './SitePage.module.css';

/** Ritorno da Discord: completa l'accesso e torna alla pagina da cui era partito; se non riesce, spiega perché. */
export function Component() {
  const { messages } = useI18n();
  const siteTexts = messages.site;
  const callbackTexts = siteTexts.signInCallback;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<Extract<SignInCompletion, { isSuccess: false }> | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void completeSignIn(searchParams).then((result) => {
      if (!isCurrent) return;
      if (result.isSuccess) void navigate(result.returnTo, { replace: true });
      else setFailure(result);
    });
    return () => {
      isCurrent = false;
    };
  }, [navigate, searchParams]);

  return (
    <div className={pageStyles.sitePage}>
      <ToolPageHeader
        name={failure ? callbackTexts.failedTitle : callbackTexts.title}
        description={failure ? siteTexts.account.errors[failure.errorCode] : callbackTexts.inProgress}
        backLink={{ to: '/', label: siteTexts.backToHome }}
        documentTitle={siteTexts.documentTitle(callbackTexts.title)}
      />
      {failure && (
        <div>
          <DiscordSignInButton onClick={() => void signInWithDiscord('/')}>{messages.auth.signInWithDiscord}</DiscordSignInButton>
        </div>
      )}
    </div>
  );
}
