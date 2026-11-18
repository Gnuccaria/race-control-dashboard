import type { ReactNode } from 'react';
import { type WeatherKind, weatherKindOf } from '@shared/weatherRules';
import styles from './WeatherIcon.module.css';

const SUN = (
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
  </>
);
const CLOUD = <path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.7 1.5A3.3 3.3 0 0 0 7 18Z" />;

/** Disegno di ogni tipo di meteo (24×24, tratto del colore del testo). */
const DRAWINGS: Record<WeatherKind, ReactNode> = {
  sun: SUN,
  'sun-fog': (
    <>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M12 2v1.8M5.6 4.6l1.3 1.3M18.4 4.6l-1.3 1.3M3.5 9h1.8M18.7 9h1.8" />
      <path d="M4 15.5h16M6 19h12M8 22h8" />
    </>
  ),
  'light-clouds': (
    <>
      <path d="M8.5 6.5a3.2 3.2 0 0 1 5.6-1.3M15.8 7.6h2.4M14.6 3.3l1.2-1.2" />
      {CLOUD}
    </>
  ),
  'dense-clouds': (
    <>
      <path d="M9 9.5a5 5 0 0 1 9.4-1.2A3.5 3.5 0 0 1 21 14" />
      {CLOUD}
    </>
  ),
  'light-rain': (
    <>
      <path d="M7 14h10a3.5 3.5 0 0 0 .5-7 5 5 0 0 0-9.6 1.4A2.8 2.8 0 0 0 7 14Z" />
      <path d="M9 17.5l-1 2.5M15 17.5l-1 2.5" />
    </>
  ),
  'heavy-rain': (
    <>
      <path d="M7 13h10a3.5 3.5 0 0 0 .5-7 5 5 0 0 0-9.6 1.4A2.8 2.8 0 0 0 7 13Z" />
      <path d="M8 16l-1.5 4M12 16l-1.5 4M16 16l-1.5 4M10 21l-.5 1.2M14 21l-.5 1.2" />
    </>
  ),
};

interface WeatherIconProps {
  /** Codice meteo (S01…R08); senza codice non disegna nulla. */
  readonly code: string;
  /** Nome del tipo di meteo per i lettori di schermo (es. "Pioggia pesante"). */
  readonly label: string;
}

/** Icona del meteo di uno slot: sole, sole con leggera nebbia, nuvole leggere o dense, pioggia leggera o pesante. */
export function WeatherIcon({ code, label }: WeatherIconProps) {
  if (code === '') return null;
  const kind = weatherKindOf(code);
  return (
    <svg className={styles.weatherIcon} data-kind={kind} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label}>
      {DRAWINGS[kind]}
    </svg>
  );
}
