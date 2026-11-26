/**
 * Regole di un equipaggio, condivise tra app desktop e server:
 * l'app le usa per guidare l'utente, il server per non fidarsi mai di ciò che riceve.
 */

import { CHAMPIONSHIP_NAME_MAX_LENGTH, normalizeChampionshipName, sortChampionshipNames } from './championshipRules';
import { fieldsOf, isPositiveInteger, normalizeSpaces } from './valueRules';

/** Nome di un campionato creato in "Gestione campionati" (shared/championshipRules.ts). */
export type CrewChampionship = string;

/**
 * Un equipaggio partecipa a zero, uno o più campionati, e in ognuno ha la sua auto, scelta tra quelle disponibili
 * in quel campionato (le vetture ammesse del campionato). L'auto può mancare (null) solo negli equipaggi
 * importati da CSV, finché qualcuno non la completa.
 */
export interface CrewChampionshipEntry {
  readonly championship: CrewChampionship;
  readonly carId: number | null;
}

/** Nomi precedenti ancora riconosciuti nei file importati (in minuscolo). */
export const CHAMPIONSHIP_FORMER_NAMES: Readonly<Record<string, string>> = {
  'fie cool1': 'Cool1 FIE Championship',
};

export const CREW_NAME_MAX_LENGTH = 48;

/** Colore dell'equipaggio: sempre salvato come esadecimale maiuscolo, es. "#E10600". */
const CREW_COLOR_PATTERN = /^#[0-9A-F]{6}$/;
export const CREW_NUMBER_MIN = 0;
export const CREW_NUMBER_MAX = 999;
const CREW_NUMBER_MAX_DIGITS = String(CREW_NUMBER_MAX).length;

/** Parole di sole lettere (anche accentate) e cifre, separate da uno spazio: niente punteggiatura o simboli. */
const CREW_NAME_PATTERN = /^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u;
const CREW_NUMBER_PATTERN = /^\d{1,3}$/;
const NON_DIGIT_PATTERN = /\D/g;

export interface CrewDraft {
  readonly name: string;
  readonly number: number;
  /** Campionati dell'equipaggio (anche nessuno), ognuno una volta sola, ognuno con la sua auto. */
  readonly championships: readonly CrewChampionshipEntry[];
  /** Esadecimale "#RRGGBB"; obbligatorio da app e API, può mancare negli equipaggi importati da CSV. */
  readonly color: string | null;
  /**
   * ID del canale Discord dell'equipaggio, dove il bot scrive il risultato dei ticket di disconnessione.
   * Facoltativo; assente nei dati che non lo conoscono (es. importazione da CSV, che non lo cambia).
   */
  readonly discordChannelId?: string | null;
  /**
   * ID del ruolo Discord dell'equipaggio: chi lo ha appartiene all'equipaggio (ticket e proteste del sito).
   * Facoltativo (senza, l'equipaggio si riconosce dal nome del ruolo "#N ..."); assente come il canale nei dati da CSV.
   */
  readonly discordRoleId?: string | null;
}

/** Equipaggio come salvato dal server. */
export interface SavedCrew extends CrewDraft {
  readonly id: number;
  readonly createdAt: string;
}

/**
 * Forma canonica di un testo: spazi iniziali e finali tolti, spazi multipli ridotti a uno,
 * caratteri composti normalizzati (NFC). È la forma che viene convalidata e salvata.
 */
export function normalizeCrewText(rawText: string): string {
  return normalizeSpaces(rawText);
}

export type CrewNameIssue = 'required' | 'invalid-characters' | 'too-long';

/** Problema del nome (testo grezzo, come digitato); null se valido. */
export function findCrewNameIssue(rawName: string): CrewNameIssue | null {
  const name = normalizeCrewText(rawName);
  if (name.length === 0) return 'required';
  if (!CREW_NAME_PATTERN.test(name)) return 'invalid-characters';
  if ([...name].length > CREW_NAME_MAX_LENGTH) return 'too-long';
  return null;
}

/** Tiene solo le cifre e al massimo tre: impedisce di scrivere (o incollare) altro nel campo numero. */
export function sanitizeCrewNumberInput(rawValue: string): string {
  return rawValue.replace(NON_DIGIT_PATTERN, '').slice(0, CREW_NUMBER_MAX_DIGITS);
}

/** "7", "042", "999" → numero; testo vuoto o non valido → null. */
export function parseCrewNumber(numberText: string): number | null {
  return CREW_NUMBER_PATTERN.test(numberText) ? Number(numberText) : null;
}

/** "#e10600", "e10600", " #E10600 " → "#E10600"; null se non è un colore esadecimale a 6 cifre. */
export function normalizeCrewColor(rawColor: string): string | null {
  const trimmedColor = rawColor.trim().toUpperCase();
  const prefixedColor = trimmedColor.startsWith('#') ? trimmedColor : `#${trimmedColor}`;
  return CREW_COLOR_PATTERN.test(prefixedColor) ? prefixedColor : null;
}

/** ID Discord ("snowflake"): da 17 a 20 cifre. */
const DISCORD_ID_PATTERN = /^\d{17,20}$/;
/** Link a un canale: https://discord.com/channels/<server>/<canale>. */
const DISCORD_CHANNEL_LINK_PATTERN = /discord(?:app)?\.com\/channels\/\d{17,20}\/(\d{17,20})(?:[/?#]|$)/;

/**
 * "1571641908688588963", " 1571641908688588963 " o il link del canale ("Copia link")
 * → ID del canale; null se non è né un ID né un link a un canale.
 */
export function normalizeDiscordChannelId(rawValue: string): string | null {
  const text = rawValue.trim();
  if (DISCORD_ID_PATTERN.test(text)) return text;
  return DISCORD_CHANNEL_LINK_PATTERN.exec(text)?.[1] ?? null;
}

/** Menzione di un ruolo come la scrive Discord: <@&ID>. */
const DISCORD_ROLE_MENTION_PATTERN = /^<@&(\d{17,20})>$/;

/**
 * "1571641908688588963", " 1571641908688588963 " o la menzione "<@&1571641908688588963>"
 * → ID del ruolo; null se non è un ID di ruolo.
 */
export function normalizeDiscordRoleId(rawValue: string): string | null {
  const text = rawValue.trim();
  if (DISCORD_ID_PATTERN.test(text)) return text;
  return DISCORD_ROLE_MENTION_PATTERN.exec(text)?.[1] ?? null;
}

/** Un nome di campionato ben formato (che il campionato esista lo controlla il server). */
export const isCrewChampionship = (value: unknown): value is CrewChampionship =>
  typeof value === 'string' && value === normalizeChampionshipName(value) && value !== '' && [...value].length <= CHAMPIONSHIP_NAME_MAX_LENGTH;

/** L'equipaggio partecipa al campionato? */
export const isCrewInChampionship = (crew: Pick<CrewDraft, 'championships'>, championship: string): boolean =>
  crew.championships.some((entry) => entry.championship === championship);

/** Auto dell'equipaggio in quel campionato; null senza auto o se l'equipaggio non vi partecipa. */
export const crewCarIn = (crew: Pick<CrewDraft, 'championships'>, championship: string): number | null =>
  crew.championships.find((entry) => entry.championship === championship)?.carId ?? null;

const isCrewNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= CREW_NUMBER_MIN && value <= CREW_NUMBER_MAX;

/** Chiave di confronto per i duplicati: "Team Rosso" e "team  rosso" sono lo stesso nome. */
export function toCrewNameKey(name: string): string {
  return normalizeCrewText(name).toLowerCase();
}

export interface CrewDraftIssues {
  readonly name?: CrewNameIssue;
  readonly number?: 'invalid';
  /** invalid = elenco o campionato non valido, repeated = campionato ripetuto, car-required/car-invalid = auto di un campionato. */
  readonly championships?: 'invalid' | 'repeated' | 'car-required' | 'car-invalid';
  readonly color?: 'invalid' | 'required';
  readonly discordChannelId?: 'invalid';
  readonly discordRoleId?: 'invalid';
}

export type CrewDraftValidation =
  | { readonly isValid: true; readonly crew: CrewDraft }
  | { readonly isValid: false; readonly issues: CrewDraftIssues };

export interface CrewDraftValidationOptions {
  /**
   * true per il form e l'API (default): colore e auto di ogni campionato sono obbligatori.
   * false per l'importazione da CSV, dove possono mancare (ma se presenti devono essere validi).
   */
  readonly areDetailsRequired?: boolean;
}

const isMissing = (value: unknown) => value === undefined || value === null || value === '';

/** Campo di dettaglio: mancante → 'required' solo se obbligatorio; presente ma non valido → 'invalid'. */
function findDetailIssue(rawValue: unknown, parsedValue: unknown, isRequired: boolean): 'invalid' | 'required' | undefined {
  if (isMissing(rawValue)) return isRequired ? 'required' : undefined;
  return parsedValue === null ? 'invalid' : undefined;
}

/** Convalida dati di origine sconosciuta (es. il corpo JSON di una richiesta) e li restituisce in forma canonica. */
export function validateCrewDraft(
  input: unknown,
  { areDetailsRequired = true }: CrewDraftValidationOptions = {},
): CrewDraftValidation {
  const candidate = fieldsOf(input);

  const name = typeof candidate.name === 'string' ? normalizeCrewText(candidate.name) : '';
  const nameIssue = findCrewNameIssue(name);

  const crewNumber = isCrewNumber(candidate.number) ? candidate.number : null;

  // Che l'auto esista e sia disponibile nel campionato lo controlla il server, che conosce la tabella delle auto.
  const championshipsReading = readCrewChampionships(candidate.championships ?? [], areDetailsRequired);
  const championshipsIssue = 'issue' in championshipsReading ? championshipsReading.issue : undefined;
  const color = typeof candidate.color === 'string' ? normalizeCrewColor(candidate.color) : null;

  const colorIssue = findDetailIssue(candidate.color, color, areDetailsRequired);
  // Il canale Discord è sempre facoltativo.
  const discordChannelId = typeof candidate.discordChannelId === 'string' ? normalizeDiscordChannelId(candidate.discordChannelId) : null;
  const channelIssue = findDetailIssue(candidate.discordChannelId, discordChannelId, false);
  // Anche il ruolo Discord è sempre facoltativo.
  const discordRoleId = typeof candidate.discordRoleId === 'string' ? normalizeDiscordRoleId(candidate.discordRoleId) : null;
  const roleIssue = findDetailIssue(candidate.discordRoleId, discordRoleId, false);

  if (nameIssue || crewNumber === null || championshipsIssue || !('championships' in championshipsReading) || colorIssue || channelIssue || roleIssue) {
    return {
      isValid: false,
      issues: {
        ...(nameIssue && { name: nameIssue }),
        ...(crewNumber === null && { number: 'invalid' as const }),
        ...(championshipsIssue && { championships: championshipsIssue }),
        ...(colorIssue && { color: colorIssue }),
        ...(channelIssue && { discordChannelId: 'invalid' as const }),
        ...(roleIssue && { discordRoleId: 'invalid' as const }),
      },
    };
  }
  const { championships } = championshipsReading;
  return { isValid: true, crew: { name, number: crewNumber, championships, color, discordChannelId, discordRoleId } };
}


/** Campionati dal corpo della richiesta, in ordine alfabetico; l'auto è obbligatoria se isCarRequired. */
function readCrewChampionships(
  rawValue: unknown,
  isCarRequired: boolean,
): { readonly championships: CrewChampionshipEntry[] } | { readonly issue: NonNullable<CrewDraftIssues['championships']> } {
  if (!Array.isArray(rawValue)) return { issue: 'invalid' };
  const entries: CrewChampionshipEntry[] = [];
  for (const rawEntry of rawValue as unknown[]) {
    const { championship, carId } = fieldsOf(rawEntry);
    if (!isCrewChampionship(championship)) return { issue: 'invalid' };
    if (entries.some((entry) => entry.championship.toLowerCase() === championship.toLowerCase())) return { issue: 'repeated' };
    if (carId === undefined || carId === null || carId === '') {
      if (isCarRequired) return { issue: 'car-required' };
      entries.push({ championship, carId: null });
    } else if (isPositiveInteger(carId)) entries.push({ championship, carId });
    else return { issue: 'car-invalid' };
  }
  return { championships: sortCrewChampionships(entries) };
}

/** Campionati di un equipaggio in ordine alfabetico. */
export function sortCrewChampionships<Entry extends { readonly championship: string }>(entries: readonly Entry[]): Entry[] {
  const order = sortChampionshipNames(entries.map((entry) => entry.championship));
  return [...entries].sort((first, second) => order.indexOf(first.championship) - order.indexOf(second.championship));
}
