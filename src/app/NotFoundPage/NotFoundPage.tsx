import { StatusMessage } from '@/components/feedback/StatusMessage/StatusMessage';
import { DocumentTitle } from '@/components/layout/DocumentTitle/DocumentTitle';
import { formatDocumentTitle } from '@/config/appConfig';
import { useI18n } from '@/i18n/useI18n';

export function NotFoundPage() {
  const { messages } = useI18n();

  return (
    <>
      <DocumentTitle title={formatDocumentTitle(messages.pages.notFoundTitle)} />
      <StatusMessage title={messages.pages.notFoundTitle} description={messages.pages.notFoundDescription} />
    </>
  );
}
