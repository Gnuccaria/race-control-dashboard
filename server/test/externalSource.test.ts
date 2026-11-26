import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalSourceError, fetchSourceText, loadRefreshSources, readRefreshFlags } from '../src/sources/externalSource';

describe('aggiornamento dai siti: parti comuni a vetture e tracciati', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('legge apply e refetch: facoltativi (refetch di default sì), rifiuta valori non booleani', () => {
    expect(readRefreshFlags({})).toEqual({ apply: false, refetch: true });
    expect(readRefreshFlags({ apply: true, refetch: false })).toEqual({ apply: true, refetch: false });
    expect(readRefreshFlags({ apply: 'sì' })).toBeNull();
  });

  it('un sito che non risponde o risponde con errore diventa l\'errore della fonte', async () => {
    const sourceError = (reason: 'unreachable' | 'changed', message: string) => new ExternalSourceError('wiki', reason, message);
    await expect(fetchSourceText(() => Promise.reject(new Error('rete')), 'https://a.example', {}, sourceError)).rejects.toMatchObject({ source: 'wiki', reason: 'unreachable' });
    await expect(fetchSourceText(() => Promise.resolve(new Response('', { status: 503 })), 'https://a.example', {}, sourceError)).rejects.toThrow('HTTP 503');
    expect(await fetchSourceText(() => Promise.resolve(new Response('ok')), 'https://a.example', {}, sourceError)).toBe('ok');
  });

  it('fonti salvate senza refetch; altrimenti scaricate e salvate; sito cambiato → 502 con codice e fonte', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const saveStaged = vi.fn(() => Promise.resolve());
    const base = { readStaged: () => Promise.resolve({ from: 'staged' }), saveStaged, logLabel: 'prova', errorCodes: { unreachable: 'track-source-unreachable', changed: 'track-source-changed' } } as const;
    expect(await loadRefreshSources({ ...base, refetch: false, fetchFresh: () => Promise.resolve({ from: 'fresh' }) })).toEqual({ from: 'staged' });
    expect(await loadRefreshSources({ ...base, refetch: true, fetchFresh: () => Promise.resolve({ from: 'fresh' }) })).toEqual({ from: 'fresh' });
    expect(saveStaged).toHaveBeenCalledWith({ from: 'fresh' });

    const failed = await loadRefreshSources({ ...base, refetch: true, fetchFresh: () => Promise.reject(new ExternalSourceError('maps', 'changed', 'tabella sparita')) });
    expect(failed).toBeInstanceOf(Response);
    const response = failed as Response;
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: { code: 'track-source-changed', details: { source: 'maps' } } });
  });
});
