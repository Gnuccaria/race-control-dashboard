import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceAuthSessionForTests } from '@/features/auth/authSessionStore';
import { MESSAGES_BY_LOCALE } from '@/i18n/messages';
import { TEST_USER } from '@/test/renderWithRouter';
import { requestServerApi } from './serverApi';
import { serverErrorText } from './serverErrorText';

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));

const messages = MESSAGES_BY_LOCALE.it;
const readName = (body: unknown) => (body as { name: string }).name;

describe('richieste al server', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    replaceAuthSessionForTests({ status: 'signed-in', user: TEST_USER }, { accessToken: 'token', refreshToken: 'refresh' });
  });

  it('traduce i codici conosciuti nel loro messaggio', async () => {
    vi.mocked(tauriFetch).mockResolvedValue(Response.json({ error: { code: 'duplicate-championship-name' } }, { status: 409 }));
    const result = await requestServerApi({ method: 'POST', path: '/championships', body: {} }, readName);
    expect(result).toEqual({ isSuccess: false, errorKind: 'duplicate-championship-name' });
  });

  it("un errore imprevisto porta nel messaggio richiesta, stato e codice (o che la risposta non è JSON)", async () => {
    vi.mocked(tauriFetch).mockResolvedValue(new Response('<html>sito</html>', { status: 405 }));
    const notJson = await requestServerApi({ method: 'POST', path: '/championships', body: {} }, readName);
    expect(notJson).toEqual({ isSuccess: false, errorKind: 'unexpected' });
    expect(serverErrorText(messages, 'unexpected')).toBe(
      'Il server ha risposto con un errore imprevisto. Riprova. (dettaglio: POST /championships → HTTP 405, risposta non JSON)',
    );

    vi.mocked(tauriFetch).mockResolvedValue(Response.json({ error: { code: 'codice-nuovo' } }, { status: 409 }));
    await requestServerApi({ method: 'PUT', path: '/championships/3', body: {} }, readName);
    expect(serverErrorText(messages, 'unexpected')).toContain('(dettaglio: PUT /championships/3 → HTTP 409 codice-nuovo)');

    // Una risposta "riuscita" che non è JSON (una pagina del sito) è anche lei un errore imprevisto, non un crash.
    vi.mocked(tauriFetch).mockResolvedValue(new Response('<html>sito</html>', { status: 200 }));
    expect(await requestServerApi({ method: 'GET', path: '/championships' }, readName)).toEqual({ isSuccess: false, errorKind: 'unexpected' });
    expect(serverErrorText(messages, 'unexpected')).toContain('GET /championships → HTTP 200, risposta non JSON');
    expect(serverErrorText(messages, 'not-found')).toBe(messages.serverErrors['not-found']);
  });
});
