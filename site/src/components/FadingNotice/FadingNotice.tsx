import { useEffect, useEffectEvent, useState } from 'react';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import styles from './FadingNotice.module.css';

/** Quanto resta visibile il messaggio e quanto dura la dissolvenza (deve coincidere con la transizione nel CSS). */
const VISIBLE_MS = 5000;
const FADE_MS = 600;

/**
 * Messaggio di conferma temporaneo: resta 5 secondi, si dissolve e poi sparisce (onDone, per esempio per togliere
 * dall'indirizzo il parametro che lo mostra). Con "riduci movimento" sparisce senza dissolvenza.
 */
export function FadingNotice({ children, onDone }: { readonly children: string; readonly onDone: () => void }) {
  const [phase, setPhase] = useState<'visible' | 'fading' | 'gone'>('visible');
  const finish = useEffectEvent(onDone);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase('fading'), VISIBLE_MS);
    const goneTimer = setTimeout(() => {
      setPhase('gone');
      finish();
    }, VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(goneTimer);
    };
  }, []);

  if (phase === 'gone') return null;
  return (
    <div className={styles.fadingNotice} data-fading={phase === 'fading' || undefined}>
      <InlineAlert tone="success">{children}</InlineAlert>
    </div>
  );
}
