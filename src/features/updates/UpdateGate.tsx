import { type ReactNode, useEffect, useState } from 'react';
import { BrandMark } from '@/components/ui/BrandMark/BrandMark';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar';
import { useI18n } from '@/i18n/useI18n';
import { canUpdateApp, installAvailableUpdate, type UpdateProgress } from './appUpdater';
import styles from './UpdateGate.module.css';

/**
 * All'avvio controlla se c'è una versione nuova dell'app. Intanto l'app si apre normalmente; se c'è un aggiornamento
 * prende il posto dell'app una schermata con la barra di avanzamento e la percentuale, poi l'app si riavvia aggiornata.
 */
export function UpdateGate({ children }: { readonly children: ReactNode }) {
  const [progress, setProgress] = useState<UpdateProgress | null>(null);

  useEffect(() => {
    if (!canUpdateApp()) return;
    void installAvailableUpdate(setProgress).then((isInstalling) => {
      if (!isInstalling) setProgress(null);
    });
  }, []);

  return progress ? <UpdateScreen progress={progress} /> : children;
}

function UpdateScreen({ progress }: { readonly progress: UpdateProgress }) {
  const { messages } = useI18n();
  const texts = messages.updates;
  const percent = progress.totalBytes ? Math.min(100, Math.round((progress.downloadedBytes / progress.totalBytes) * 100)) : null;
  const isInstalling = progress.phase === 'installing';

  return (
    <main className={styles.updateScreen}>
      <BrandMark size="large" />
      <h1 className={styles.title}>{texts.title}</h1>
      <p className={styles.version}>{texts.version(progress.version)}</p>
      <div className={styles.progress}>
        <ProgressBar value={isInstalling ? 100 : (percent ?? 0)} maximum={100} accessibleLabel={texts.progressLabel} />
        <p role="status" aria-live="polite" className={styles.percent}>
          {isInstalling ? texts.installing : percent === null ? texts.downloading : texts.percent(percent)}
        </p>
      </div>
      <p className={styles.hint}>{texts.doNotClose}</p>
    </main>
  );
}
