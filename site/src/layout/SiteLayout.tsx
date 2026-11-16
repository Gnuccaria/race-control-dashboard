import type { ReactNode } from 'react';
import { Outlet } from 'react-router';
import { BrandHeader } from '@/components/layout/BrandHeader/BrandHeader';
import { PageFrame } from '@/components/layout/PageFrame/PageFrame';
import { useI18n } from '@/i18n/useI18n';
import { SiteAccountMenu } from './SiteAccountMenu';

/**
 * Barra con il marchio e, a destra, la tendina con l'accesso Discord, la modalità notte e la lingua
 * (la lingua automatica è quella del browser).
 */
export function SiteFrame({ children }: { readonly children: ReactNode }) {
  const { messages } = useI18n();
  const siteTexts = messages.site;
  return (
    <PageFrame
      header={
        <BrandHeader name="Race Control" tagline={siteTexts.name}>
          <SiteAccountMenu />
        </BrandHeader>
      }
    >
      {children}
    </PageFrame>
  );
}

export function SiteLayout() {
  return (
    <SiteFrame>
      <Outlet />
    </SiteFrame>
  );
}
