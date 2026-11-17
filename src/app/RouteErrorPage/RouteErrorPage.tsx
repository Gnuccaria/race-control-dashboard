import { isRouteErrorResponse, useRouteError } from 'react-router';
import { DocumentTitle } from '@/components/layout/DocumentTitle/DocumentTitle';
import { StatusMessage } from '@/components/feedback/StatusMessage/StatusMessage';
import { formatDocumentTitle } from '@/config/appConfig';
import { useI18n } from '@/i18n/useI18n';

/** Mostrata quando una rotta fallisce, ad esempio se lo strumento non si carica dopo un aggiornamento. */
export function RouteErrorPage() {
  const routeError = useRouteError();
  const { messages } = useI18n();

  const errorDescription = isRouteErrorResponse(routeError)
    ? messages.pages.serverErrorDescription(routeError.status)
    : messages.pages.unexpectedErrorDescription;

  return (
    <main>
      <DocumentTitle title={formatDocumentTitle(messages.pages.errorDocumentTitle)} />
      <StatusMessage title={messages.pages.errorTitle} description={errorDescription} />
    </main>
  );
}
