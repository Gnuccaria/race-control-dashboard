import { describe, expect, it } from 'vitest';
import { detectSystemLocale, SUPPORTED_LOCALES } from './locales';
import { MESSAGES_BY_LOCALE } from './messages';

describe('lingue', () => {
  it('usa la prima lingua del sistema supportata, anche con varianti regionali', () => {
    expect(detectSystemLocale(['de-CH', 'en-US'])).toBe('de');
    expect(detectSystemLocale(['es-ES', 'fr-CA'])).toBe('fr');
    expect(detectSystemLocale(['IT'])).toBe('it');
  });

  it("ripiega sull'inglese se nessuna lingua del sistema è supportata", () => {
    expect(detectSystemLocale(['ja-JP', 'pt-BR'])).toBe('en');
    expect(detectSystemLocale([])).toBe('en');
  });

  it('ogni lingua ha almeno un saluto per ogni fascia oraria e i passi di ogni guida', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const localeMessages = MESSAGES_BY_LOCALE[locale];
      for (const periodGreetings of Object.values(localeMessages.home.greetings)) {
        expect(periodGreetings.length).toBeGreaterThan(0);
        for (const greetUser of periodGreetings) expect(greetUser('Niko')).toContain('Niko');
      }
      expect(localeMessages.lapCalculator.usageSteps).toHaveLength(MESSAGES_BY_LOCALE.it.lapCalculator.usageSteps.length);
      expect(localeMessages.bopDeficit.usageSteps).toHaveLength(MESSAGES_BY_LOCALE.it.bopDeficit.usageSteps.length);
      expect(localeMessages.fieDisconnections.usageSteps).toHaveLength(
        MESSAGES_BY_LOCALE.it.fieDisconnections.usageSteps.length,
      );
    }
  });
});
