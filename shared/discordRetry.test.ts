import { describe, expect, it } from 'vitest';
import { discordRetryAfterMs, fetchDiscordWithRetry } from './discordRetry';

const rateLimited = (retryAfterSeconds: number) =>
  new Response(JSON.stringify({ message: 'You are being rate limited.', retry_after: retryAfterSeconds, global: false }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  });
/** 429 del firewall di Cloudflare davanti a Discord: pagina HTML, nessuna indicazione sull'attesa. */
const firewallBlocked = () => new Response('<html>error code: 1015</html>', { status: 429 });
const ok = () => new Response('{}', { status: 200 });

/** Risposte in sequenza e attese registrate (senza aspettare davvero). */
function scripted(responses: (() => Response | Error)[]) {
  const waits: number[] = [];
  let calls = 0;
  const fetchFunction = () => {
    const next = responses[Math.min(calls, responses.length - 1)];
    calls += 1;
    const result = next ? next() : ok();
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  };
  return { fetchFunction, waits, wait: (milliseconds: number) => (waits.push(milliseconds), Promise.resolve()), calls: () => calls };
}

describe('chiamate a Discord con nuovi tentativi', () => {
  it('legge l’attesa dal corpo di Discord o dalle intestazioni; null per il firewall', async () => {
    expect(await discordRetryAfterMs(rateLimited(1.25))).toBe(1250);
    expect(await discordRetryAfterMs(new Response('', { status: 429, headers: { 'Retry-After': '2' } }))).toBe(2000);
    expect(await discordRetryAfterMs(new Response('', { status: 429, headers: { 'X-RateLimit-Reset-After': '0.5' } }))).toBe(500);
    expect(await discordRetryAfterMs(firewallBlocked())).toBeNull();
  });

  it('dopo un 429 aspetta quanto chiede Discord e riprova', async () => {
    const discord = scripted([() => rateLimited(1.2), ok]);
    const response = await fetchDiscordWithRetry(discord.fetchFunction, 'https://discord.test', {}, { wait: discord.wait });
    expect(response.status).toBe(200);
    expect(discord.waits).toEqual([1250]);
  });

  it('un 429 del firewall si riprova dopo un’attesa fissa', async () => {
    const discord = scripted([firewallBlocked, firewallBlocked, ok]);
    const response = await fetchDiscordWithRetry(discord.fetchFunction, 'https://discord.test', {}, { wait: discord.wait });
    expect(response.status).toBe(200);
    expect(discord.waits).toEqual([1050, 2550]);
  });

  it('un’attesa troppo lunga o i tentativi finiti restituiscono il 429', async () => {
    const tooLong = scripted([() => rateLimited(30)]);
    expect((await fetchDiscordWithRetry(tooLong.fetchFunction, 'https://discord.test', {}, { wait: tooLong.wait })).status).toBe(429);
    expect(tooLong.calls()).toBe(1);
    const always = scripted([() => rateLimited(0.1)]);
    expect((await fetchDiscordWithRetry(always.fetchFunction, 'https://discord.test', {}, { wait: always.wait, maxRetries: 2 })).status).toBe(429);
    expect(always.calls()).toBe(3);
  });

  it('errori del server e di rete si riprovano solo per le richieste ripetibili', async () => {
    const notRepeatable = scripted([() => new Response('', { status: 502 }), ok]);
    expect((await fetchDiscordWithRetry(notRepeatable.fetchFunction, 'https://discord.test', {}, { wait: notRepeatable.wait })).status).toBe(502);
    const repeatable = scripted([() => new Response('', { status: 503 }), () => new TypeError('rete'), ok]);
    const response = await fetchDiscordWithRetry(repeatable.fetchFunction, 'https://discord.test', {}, { wait: repeatable.wait, retryServerErrors: true });
    expect(response.status).toBe(200);
    expect(repeatable.calls()).toBe(3);
    const offline = scripted([() => new TypeError('rete')]);
    await expect(fetchDiscordWithRetry(offline.fetchFunction, 'https://discord.test', {}, { wait: offline.wait })).rejects.toThrow('rete');
  });
});
