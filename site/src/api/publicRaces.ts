import type { PublicRace, RaceSummary } from '@shared/raceRules';

/** Stesso indirizzo del sito (il server serve entrambi); per provare contro un altro server: VITE_PUBLIC_API_URL. */
export const API_BASE_URL = import.meta.env.VITE_PUBLIC_API_URL ?? '';

/**
 * Legge una risposta JSON delle API pubbliche. isNotFoundMeaningful: solo per una singola gara un 404
 * vuol dire "gara inesistente" (risposta 404 per la pagina d'errore); per l'elenco vuol dire che il
 * server non ha le API pubbliche (es. versione vecchia non ancora ripubblicata), quindi è un errore.
 */
async function getJson<Body>(path: string, signal: AbortSignal, isNotFoundMeaningful = false): Promise<Body> {
  const response = await fetch(`${API_BASE_URL}${path}`, { signal, headers: { Accept: 'application/json' } });
  if (response.status === 404 && isNotFoundMeaningful) throw new Response(null, { status: 404 });
  if (!response.ok) throw new Error(`Richiesta ${path} non riuscita (${response.status})`);
  return (await response.json()) as Body;
}

export const fetchPublicRaces = async (signal: AbortSignal) =>
  (await getJson<{ races: RaceSummary[] }>('/public/races', signal)).races;

/** Referto di gara in PDF, generato dal server: in italiano con il sito in italiano, in inglese con ogni altra lingua. */
export const publicRaceReportUrl = (raceId: number, locale: string) =>
  `${API_BASE_URL}/public/races/${raceId}/report.pdf?lang=${encodeURIComponent(locale)}`;

export const fetchPublicRace = async (raceId: number, signal: AbortSignal) =>
  (await getJson<{ race: PublicRace }>(`/public/races/${raceId}`, signal, true)).race;
