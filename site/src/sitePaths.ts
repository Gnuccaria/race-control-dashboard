import { SITE_DISCONNECTION_TICKET_PATH, siteDisconnectionTicketPath } from '@shared/disconnectionTicketRules';
import { SITE_DISCORD_CALLBACK_PATH } from '@shared/siteAuth';

/** Percorsi delle pagine del sito. */
export const RACES_PATH = '/gare';
export const raceResultsPath = (raceId: number) => `${RACES_PATH}/${raceId}`;
export const DISCONNECTION_TICKET_PATH = SITE_DISCONNECTION_TICKET_PATH;
export const disconnectionTicketPath = siteDisconnectionTicketPath;
/** Modulo per inviare una protesta ai Commissari Sportivi (dopo l'accesso con Discord). */
export const PROTEST_PATH = '/protesta';
export const protestPath = (protestId: number) => `${PROTEST_PATH}/${protestId}`;
export { SITE_DISCORD_CALLBACK_PATH };
