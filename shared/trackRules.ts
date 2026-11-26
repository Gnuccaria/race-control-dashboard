import { isPositiveInteger, isRecord } from './valueRules';
/**
 * Tracciati aggiornati dai siti (Gestisci tracciati → Aggiorna dati), condivisi tra app e server:
 * - elenco dal wiki di Gran Turismo (gran-turismo.fandom.com, Gran Turismo 7/Track List): tracciato, nazione,
 *   configurazioni con lunghezza e senso inverso;
 * - mappe da gt-engine.com (track-maps), per il briefing pre-gara: non sono nostre, sotto la mappa va citato l'autore
 *   con il link (TRACK_MAPS_CREDIT_URL).
 */

export const TRACK_LIST_SOURCE_URL = 'https://gran-turismo.fandom.com/wiki/Gran_Turismo_7/Track_List';
export const TRACK_MAPS_CREDIT_URL = 'https://gt-engine.com/gt7/tracks/track-maps.html';
const TRACK_MAP_IMAGE_BASE_URL = 'https://gt-engine.com/gt7/tracks/images/md/';

/** Nome del file di una mappa di gt-engine.com: solo lettere minuscole, cifre e trattini, .png. */
const MAP_FILE_PATTERN = /^[a-z0-9][a-z0-9-]{0,98}\.png$/;
export const isTrackMapFile = (value: unknown): value is string => typeof value === 'string' && MAP_FILE_PATTERN.test(value);

/** Indirizzo dell'immagine di una mappa (il file è controllato: niente indirizzi arbitrari). */
export const trackMapUrl = (mapFile: string): string | null => (isTrackMapFile(mapFile) ? `${TRACK_MAP_IMAGE_BASE_URL}${mapFile}` : null);

/**
 * Nazioni come le scrive il wiki (codici sportivi a tre lettere, a volte il nome inglese) → codice ISO a due lettere,
 * che l'app traduce nella lingua scelta. Le nazioni sconosciute restano senza (null).
 */
const COUNTRY_CODES: Readonly<Record<string, string>> = {
  ARG: 'AR', AUS: 'AU', AUT: 'AT', BEL: 'BE', BRA: 'BR', CAN: 'CA', CHN: 'CN', CRO: 'HR', CZE: 'CZ', DEN: 'DK', ESP: 'ES',
  FIN: 'FI', FRA: 'FR', GBR: 'GB', GER: 'DE', HUN: 'HU', IND: 'IN', ITA: 'IT', JPN: 'JP', KOR: 'KR', MAS: 'MY', MEX: 'MX',
  MON: 'MC', NED: 'NL', NOR: 'NO', NZL: 'NZ', POL: 'PL', POR: 'PT', RSA: 'ZA', SGP: 'SG', SUI: 'CH', SWE: 'SE', THA: 'TH',
  UAE: 'AE', UK: 'GB', USA: 'US',
  AUSTRALIA: 'AU', AUSTRIA: 'AT', BELGIUM: 'BE', BRAZIL: 'BR', CANADA: 'CA', CROATIA: 'HR', FRANCE: 'FR', GERMANY: 'DE',
  ITALY: 'IT', JAPAN: 'JP', SPAIN: 'ES', SWITZERLAND: 'CH', 'UNITED KINGDOM': 'GB', 'UNITED STATES': 'US', 'UNITED ARAB EMIRATES': 'AE',
};

export function toCountryCode(rawCountry: string): string | null {
  const key = rawCountry.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(key) && key !== 'UK') return key;
  return COUNTRY_CODES[key] ?? null;
}

/** Abbinamento scelto a mano tra una configurazione del wiki e una mappa di gt-engine (null = nessuna mappa). */
export interface TrackMapMatch {
  readonly sourceKey: string;
  readonly mapFile: string | null;
}

/** Vecchio tracciato (salvato prima degli aggiornamenti dai siti) usato da gare: a quale configurazione passa (null = nessuna). */
export interface LegacyTrackMatch {
  readonly trackId: number;
  readonly sourceKey: string | null;
}

export interface TrackRefreshChange {
  readonly name: string;
  readonly changes: readonly { readonly field: 'country' | 'lengthMeters' | 'hasReverseLayout' | 'mapFile' | 'reverseMapFile'; readonly before: string | number | boolean | null; readonly after: string | number | boolean | null }[];
}

export interface TrackRefreshPreview {
  /** Configurazioni lette dal wiki. */
  readonly trackCount: number;
  readonly inserted: readonly string[];
  readonly updated: readonly TrackRefreshChange[];
  readonly deleted: readonly string[];
  /** Non più nel wiki (o non abbinati) ma usati da gare: restano. */
  readonly kept: readonly string[];
  /** Vecchi tracciati usati da gare senza una configurazione del wiki: si abbinano a mano. */
  readonly unmatchedLegacy: readonly { readonly trackId: number; readonly name: string; readonly usageCount: number }[];
  /** Configurazioni del wiki (per gli abbinamenti a mano). */
  readonly layouts: readonly { readonly sourceKey: string; readonly name: string }[];
  /** Configurazioni senza mappa trovata e mappe rimaste libere. */
  readonly layoutsWithoutMap: readonly { readonly sourceKey: string; readonly name: string }[];
  readonly unmatchedMaps: readonly { readonly file: string; readonly label: string }[];
}

const isSourceKey = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;

/** Abbinamenti delle mappe dalla richiesta; null se non validi (assenti = nessuno). */
export function readTrackMapMatches(rawValue: unknown): TrackMapMatch[] | null {
  if (rawValue === undefined) return [];
  if (!Array.isArray(rawValue) || rawValue.length > 500) return null;
  const matches: TrackMapMatch[] = [];
  for (const entry of rawValue) {
    if (!isRecord(entry) || !isSourceKey(entry.sourceKey) || !(entry.mapFile === null || isTrackMapFile(entry.mapFile))) return null;
    matches.push({ sourceKey: entry.sourceKey, mapFile: entry.mapFile });
  }
  return matches;
}

/** Abbinamenti dei vecchi tracciati dalla richiesta; null se non validi. */
export function readLegacyTrackMatches(rawValue: unknown): LegacyTrackMatch[] | null {
  if (rawValue === undefined) return [];
  if (!Array.isArray(rawValue) || rawValue.length > 500) return null;
  const matches: LegacyTrackMatch[] = [];
  for (const entry of rawValue) {
    if (!isRecord(entry) || !isPositiveInteger(entry.trackId)) return null;
    if (!(entry.sourceKey === null || isSourceKey(entry.sourceKey))) return null;
    matches.push({ trackId: entry.trackId, sourceKey: entry.sourceKey });
  }
  return matches;
}

const METERS_PER_MILE = 1609.344;

/** Lunghezza in km e in miglia (es. 5809 → { km: 5.809, miles: 3.61 }). */
export const trackLengthUnits = (lengthMeters: number): { readonly km: number; readonly miles: number } => ({
  km: lengthMeters / 1000,
  miles: Math.round((lengthMeters / METERS_PER_MILE) * 100) / 100,
});
