import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { createTestApp, createTestEnv, getPath, sendJson, withSchedule } from './support/testApp';

const row = (code: string, length: number) => Array.from({ length }, () => code);
/** Gara di 6 ore del Cool1 FIE con stint da 60 minuti: 6 stint. */
const pattern = (stints = 6) => ({ qualifying: ['S01', 'C04'], stints: Array.from({ length: stints }, (_unused, index) => row(index % 2 === 0 ? 'S08' : 'R05', 9)) });

describe('pattern meteo delle gare', () => {
  let env: Env;
  let handleRequest: ReturnType<typeof createTestApp>;
  const request = async (method: 'GET' | 'PUT' | 'POST' | 'DELETE', path: string, body?: unknown, token = 'token-race-control') => {
    const response = await handleRequest(method === 'GET' ? getPath(path, token) : sendJson(method, path, body, token), env);
    return { status: response.status, body: (await response.json()) as { weather?: unknown; error?: { code: string; details?: unknown } } };
  };

  beforeEach(async () => {
    env = createTestEnv();
    handleRequest = createTestApp();
    await request('POST', '/races', withSchedule({ championship: 'Cool1 FIE Championship', duration: 6, round: 1, trackId: null, raceDate: '2026-11-08', results: [] }), 'token-organization');
  });

  it('una riga di qualifica (2 slot) e una per ogni stint (9 slot): senza pattern solo il numero di stint', async () => {
    expect(await request('GET', '/races/1/weather', undefined, 'token-steward')).toEqual({ status: 200, body: { weather: { stintCount: 6, pattern: null } } });
    expect((await request('GET', '/races/9/weather')).status).toBe(404);
  });

  it('lo salva solo il Direttore Gara, con tutti gli slot compilati e i codici previsti; il sito lo legge con la gara', async () => {
    expect((await request('PUT', '/races/1/weather', { pattern: pattern() }, 'token-organization')).status).toBe(403);
    const saved = await request('PUT', '/races/1/weather', { pattern: pattern() });
    expect(saved).toEqual({ status: 200, body: { weather: { stintCount: 6, pattern: pattern() } } });
    for (const invalid of [
      pattern(5),
      { ...pattern(), qualifying: ['S01'] },
      { ...pattern(), qualifying: ['S01', 'S14'] },
      { ...pattern(), stints: [...pattern(5).stints, row('', 9)] },
      { ...pattern(), stints: [...pattern(5).stints, row('C01', 8)] },
    ]) {
      expect((await request('PUT', '/races/1/weather', { pattern: invalid })).body.error).toEqual({ code: 'invalid-weather', details: { stintCount: 6 } });
    }
    const publicRace = (await (await handleRequest(getPath('/public/races/1'), env)).json()) as { race: { weather: unknown } };
    expect(publicRace.race.weather).toEqual({ stintCount: 6, pattern: pattern() });
    // Eliminando la gara si elimina anche il suo meteo.
    expect((await request('DELETE', '/races', { ids: [1] }, 'token-organization')).status).toBe(200);
    expect(await env.CREWS_DB.prepare('SELECT COUNT(*) AS count FROM race_weather').first()).toEqual({ count: 0 });
  });

  it('se la durata della gara cambia, il pattern salvato si adatta ai nuovi stint (righe in più tolte, mancanti vuote)', async () => {
    await request('PUT', '/races/1/weather', { pattern: pattern() });
    await env.CREWS_DB.prepare('UPDATE races SET duration = 12').run();
    const weather = (await request('GET', '/races/1/weather')).body.weather as { stintCount: number; pattern: { stints: string[][] } };
    // 12 ore con stint da 120 minuti: ancora 6 stint.
    expect(weather.stintCount).toBe(6);
    await env.CREWS_DB.prepare("INSERT INTO championship_durations (championship_id, hours, stint_minutes) SELECT id, 3, 60 FROM championships WHERE name = 'Cool1 FIE Championship'").run();
    await env.CREWS_DB.prepare('UPDATE races SET duration = 3').run();
    const shorter = (await request('GET', '/races/1/weather')).body.weather as { stintCount: number; pattern: { stints: string[][] } };
    expect(shorter.stintCount).toBe(3);
    expect(shorter.pattern.stints).toHaveLength(3);
  });
});
