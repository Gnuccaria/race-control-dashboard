import { type RaceWeather as RaceWeatherData, weatherKindOf } from '@shared/weatherRules';
import { EmptyState } from '@/components/data-table/ListStatus';
import { WeatherIcon } from '@/components/ui/WeatherIcon/WeatherIcon';
import { WeatherPatternGrid } from '@/features/weather/components/WeatherPatternGrid';
import { useI18n } from '@/i18n/useI18n';
import styles from './RaceWeather.module.css';

/** Scheda Meteo: la qualifica (2 slot) e una riga per ogni stint (9 slot), con l'icona del meteo e il codice di ogni slot. */
export function RaceWeather({ weather }: { readonly weather: RaceWeatherData }) {
  const { messages } = useI18n();
  const texts = messages.weather;
  const { pattern } = weather;
  if (!pattern) return <EmptyState title={texts.notPublished} />;
  return (
    <WeatherPatternGrid
      stintCount={weather.stintCount}
      renderSlot={({ row, slot, label }) => {
        const code = (row === 0 ? pattern.qualifying[slot] : pattern.stints[row - 1]?.[slot]) ?? '';
        return (
          <span className={styles.slot} aria-label={code === '' ? `${label}: –` : `${label}: ${code}, ${texts.kinds[weatherKindOf(code)]}`} role="group">
            {code === '' ? (
              <span className={styles.missing}>–</span>
            ) : (
              <>
                <WeatherIcon code={code} label={texts.kinds[weatherKindOf(code)]} />
                <span className={styles.code}>{code}</span>
              </>
            )}
          </span>
        );
      }}
    />
  );
}
