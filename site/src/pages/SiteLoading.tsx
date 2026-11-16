import { LoadingStatus } from '@/components/data-table/ListStatus';
import { useI18n } from '@/i18n/useI18n';
import { SiteFrame } from '../layout/SiteLayout';
import styles from './SitePage.module.css';

/** Mostrata al primo avvio, mentre arrivano i dati della pagina richiesta. */
export function SiteLoading() {
  const { messages } = useI18n();
  return (
    <SiteFrame>
      <div className={styles.sitePage}>
        <LoadingStatus>{messages.site.loading}</LoadingStatus>
      </div>
    </SiteFrame>
  );
}
