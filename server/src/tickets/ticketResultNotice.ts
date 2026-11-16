import { siteDisconnectionTicketPath, type TicketDiscordMessage, type TicketResultDetails } from '../../../shared/disconnectionTicketRules';
import { fetchWithDiscordRetry } from '../discord/discordRateLimit';
import type { Env } from '../env';
import type { DiscordFetch } from '../siteAuth/siteDiscordAuth';
import type { TicketNoticeTarget } from './ticketRepository';

const DISCORD_API_URL = 'https://discord.com/api/v10';

/** Minuti e secondi interi del tempo di attesa, come nel calcolatore (parte intera, senza arrotondare per eccesso). */
function waitParts(totalWaitSeconds: number): { readonly minutes: number; readonly seconds: number } {
  const floor = (value: number) => Math.floor(Math.round(value * 1e9) / 1e9);
  const minutes = floor(Math.max(0, totalWaitSeconds) / 60);
  return { minutes, seconds: floor(Math.max(0, totalWaitSeconds) - minutes * 60) };
}

/** "5 minuti e 50 secondi", "1 minuto", "40 secondi" / "5 minutes and 50 seconds", "1 minute", "40 seconds". */
function waitText(minutes: number, seconds: number, language: 'it' | 'en'): string {
  const words =
    language === 'it'
      ? { minute: ['minuto', 'minuti'], second: ['secondo', 'secondi'], and: 'e' }
      : { minute: ['minute', 'minutes'], second: ['second', 'seconds'], and: 'and' };
  const part = (value: number, [singular, plural]: string[]) => `${value} ${value === 1 ? singular : plural}`;
  const parts = [...(minutes > 0 ? [part(minutes, words.minute)] : []), ...(seconds > 0 ? [part(seconds, words.second)] : [])];
  return parts.join(` ${words.and} `);
}

/**
 * Testo del messaggio, formale e impersonale: solo il tempo di attesa, in italiano e in inglese, con il link al ticket sul sito per i
 * dettagli; la menzione del ruolo dell'equipaggio chiude il messaggio. Il link è tra < > così Discord non ne
 * mostra l'anteprima.
 */
export function ticketResultMessage(target: TicketNoticeTarget, details: TicketResultDetails, ticketUrl: string): string {
  const { minutes, seconds } = waitParts(details.totalWaitSeconds);
  const hasWait = minutes > 0 || seconds > 0;
  const italian = hasWait
    ? `Il ticket di disconnessione #${target.id} è stato esaminato dalla Direzione Gara: il tempo di attesa stabilito è di **${waitText(minutes, seconds, 'it')}**.`
    : `Il ticket di disconnessione #${target.id} è stato esaminato dalla Direzione Gara: non è previsto alcun tempo di attesa e il rientro in pista è consentito immediatamente.`;
  const english = hasWait
    ? `Disconnection ticket #${target.id} has been reviewed by Race Control: the waiting time is **${waitText(minutes, seconds, 'en')}**.`
    : `Disconnection ticket #${target.id} has been reviewed by Race Control: no waiting time applies and rejoining the track is permitted immediately.`;
  return [
    `${italian} I dettagli completi sono disponibili nella pagina del ticket sul sito: <${ticketUrl}>`,
    `${english} Full details are available on the ticket page on the site: <${ticketUrl}>`,
    ...(target.crewRoleId ? [`<@&${target.crewRoleId}>`] : []),
  ].join('\n\n');
}

/**
 * Il bot "Michael Masi" scrive il risultato nel canale Discord dell'equipaggio, menzionando solo il ruolo
 * dell'equipaggio (nessun'altra menzione: niente @everyone anche se comparisse nel nome). Serve che il bot veda
 * il canale e possa scriverci; perché la menzione notifichi, il ruolo deve essere menzionabile oppure il bot
 * deve avere il permesso "Menziona tutti i ruoli".
 */
export async function postTicketResultToDiscord(
  discordFetch: DiscordFetch,
  env: Env,
  target: TicketNoticeTarget,
  details: TicketResultDetails,
  /** Indirizzo del sito (lo stesso server lo serve), per il link al ticket. */
  siteOrigin: string,
): Promise<TicketDiscordMessage> {
  if (!target.discordChannelId) return 'no-channel';
  if (!env.DISCORD_BOT_TOKEN) {
    console.error('DISCORD_BOT_TOKEN mancante: il risultato del ticket non è stato scritto su Discord');
    return 'failed';
  }
  try {
    const response = await fetchWithDiscordRetry(discordFetch, `${DISCORD_API_URL}/channels/${target.discordChannelId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: ticketResultMessage(target, details, `${siteOrigin}${siteDisconnectionTicketPath(target.id)}`),
        allowed_mentions: { parse: [], roles: target.crewRoleId ? [target.crewRoleId] : [] },
      }),
    });
    if (response.ok) return 'sent';
    console.error(`Messaggio del ticket #${target.id} non scritto nel canale ${target.discordChannelId} (${response.status}): il bot vede il canale e può scriverci?`);
    return 'failed';
  } catch {
    return 'failed';
  }
}
