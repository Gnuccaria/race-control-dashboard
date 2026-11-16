import { StatusMessage } from '@/components/feedback/StatusMessage/StatusMessage';
import { formatDocumentTitle } from '@/config/appConfig';
import { useI18n } from '@/i18n/useI18n';

export function NotFoundPage() {
  const { messages } = useI18n();

  return (
    <>
      <title>{formatDocumentTitle(messages.pages.notFoundTitle)}</title>
      <StatusMessage title={messages.pages.notFoundTitle} description={messages.pages.notFoundDescription} />
    </>
  );
}
