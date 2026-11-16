import { useState } from 'react';
import { getDayPeriod } from '@/i18n/dayPeriod';
import { useI18n } from '@/i18n/useI18n';
import styles from './WelcomeMessage.module.css';

interface WelcomeMessageProps {
  /** Nome visualizzato dell'account Discord. */
  readonly userName: string;
}

/** Saluto cordiale scelto a caso tra quelli della fascia oraria corrente. */
export function WelcomeMessage({ userName }: WelcomeMessageProps) {
  const { messages } = useI18n();
  // Letti una volta all'apertura: il render resta puro e cambiando lingua il saluto resta lo stesso.
  const [greetingChoice] = useState(() => ({
    dayPeriod: getDayPeriod(new Date().getHours()),
    variantFraction: Math.random(),
  }));

  const periodGreetings = messages.home.greetings[greetingChoice.dayPeriod];
  const greetUser =
    periodGreetings[Math.floor(greetingChoice.variantFraction * periodGreetings.length)] ?? periodGreetings[0];

  return (
    <header className={styles.welcomeMessage}>
      <h1 className={styles.welcomeTitle}>{greetUser ? greetUser(userName) : userName}</h1>
      <p className={styles.welcomeDescription}>{messages.home.chooseTool}</p>
    </header>
  );
}
