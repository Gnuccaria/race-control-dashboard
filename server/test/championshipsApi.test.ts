import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { createTestApp, createTestEnv, crewDetails, getPath, sendJson, withSchedule } from './support/testApp';

const ORGANIZATION = 'token-organization';
const FIE = 'Cool1 FIE Championship';
const JAPAN = 'All Japan GT Championship';

/** Le parti delle risposte lette dai test (solo per i tipi). */
interface ApiBody {
  readonly championship?: unknown;
  readonly championships?: unknown[];
  readonly race?: unknown;
  readonly crew: { readonly championships: unknown };
  readonly deletedCount?: number;
  readonly error: { readonly code: string; readonly details?: unknown };
}

const SPRINT = { name: 'GT3 Sprint Cup', durations: [{ hours: 2, stintMinutes: 60 }], carIds: [1, 3] };

describe('API campionati', () => {
  let env: Env;
  let handleRequest: ReturnType<typeof createTestApp>;

  const request = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, token = ORGANIZATION) => {
    const response = await handleRequest(method === 'GET' ? getPath(path, token) : sendJson(method, path, body, token), env);
    return { status: response.status, body: (await response.json()) as ApiBody };
  };

  beforeEach(() => {
    env = createTestEnv();
    handleRequest = createTestApp();
  });

  it('parte con i due campionati di prima, con durate, stint e vetture ammesse; li leggono tutti i ruoli', async () => {
    const listed = await request('GET', '/championships', undefined, 'token-steward');
    expect(listed.status).toBe(200);
    expect(listed.body.championships).toMatchObject([
      { name: JAPAN, durations: [{ hours: 3, stintMinutes: 90 }], carIds: [] },
      { name: FIE, durations: [{ hours: 6, stintMinutes: 60 }, { hours: 12, stintMinutes: 120 }], carIds: [1, 2, 3, 4, 5, 6] },
    ]);
    expect((await request('GET', '/championships', undefined, 'token-no-role')).status).toBe(403);
  });

  it("solo l'Organizzazione crea un campionato; nome unico, dati ricontrollati, vetture del catalogo", async () => {
    expect((await request('POST', '/championships', SPRINT, 'token-steward')).status).toBe(403);
    const created = await request('POST', '/championships', { ...SPRINT, name: '  GT3  Sprint Cup ' });
    expect(created.status).toBe(201);
    expect(created.body.championship).toMatchObject({ id: 3, name: 'GT3 Sprint Cup', durations: [{ hours: 2, stintMinutes: 60 }], carIds: [1, 3] });
    expect((await request('GET', '/championships/3')).body.championship).toMatchObject({ name: 'GT3 Sprint Cup' });

    const duplicate = await request('POST', '/championships', { ...SPRINT, name: 'gt3 sprint cup' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('duplicate-championship-name');
    const invalid = await request('POST', '/championships', { name: '', durations: [{ hours: 2, stintMinutes: 45 }], carIds: [] });
    expect(invalid.body).toEqual({ error: { code: 'invalid-championship', details: { name: 'required', durations: 'not-divisor', carIds: 'required' } } });
    const unknownCar = await request('POST', '/championships', { ...SPRINT, name: 'Altro', carIds: [99] });
    expect(unknownCar.body).toEqual({ error: { code: 'invalid-championship', details: { carIds: 'unknown-car' } } });
    expect((await request('GET', '/championships/99')).status).toBe(404);
  });

  it('il campionato creato si usa negli equipaggi (solo con le sue vetture) e nelle gare (solo con le sue durate e i suoi cambi)', async () => {
    await request('POST', '/championships', SPRINT);
    expect((await request('POST', '/crews', { name: 'Alfa', number: 1, ...crewDetails(1, 'GT3 Sprint Cup') })).status).toBe(201);
    const wrongCar = await request('POST', '/crews', { name: 'Beta', number: 2, ...crewDetails(2, 'GT3 Sprint Cup') });
    expect(wrongCar.body.error.details).toEqual({ championships: 'unknown-car' });

    const race = withSchedule({ championship: 'GT3 Sprint Cup', duration: 2, round: 1, trackId: null, raceDate: '2026-11-08', results: [{ position: 1, crewId: 1, laps: 10 }] });
    const wrongDuration = await request('POST', '/races', { ...race, duration: 6 });
    expect(wrongDuration.body.error.details).toEqual({ duration: 'invalid' });
    // 2 ore con stint da 60 minuti = 1 cambio pilota.
    const twoSwaps = [1, 2].map((swap) => ({ swap, crewId: 1, pitInMs: 1000, pitOutMs: 2000, isCancelled: false, notes: '' }));
    expect((await request('POST', '/races', { ...race, driverSwaps: twoSwaps })).body.error.details).toEqual({ driverSwaps: 'invalid' });
    expect((await request('POST', '/races', { ...race, driverSwaps: twoSwaps.slice(0, 1) })).status).toBe(201);
  });

  it('rinominare un campionato aggiorna gare ed equipaggi; togliere una vettura lascia l\'equipaggio senza auto', async () => {
    await request('POST', '/championships', SPRINT);
    await request('POST', '/crews', { name: 'Alfa', number: 1, ...crewDetails(3, 'GT3 Sprint Cup') });
    const race = withSchedule({ championship: 'GT3 Sprint Cup', duration: 2, round: 1, trackId: null, raceDate: '2026-11-08', results: [{ position: 1, crewId: 1, laps: 10 }] });
    expect((await request('POST', '/races', race)).status).toBe(201);

    const renamed = await request('PUT', '/championships/3', { ...SPRINT, name: 'GT3 Endurance Cup', carIds: [1] });
    expect(renamed.status).toBe(200);
    expect(renamed.body.championship).toMatchObject({ name: 'GT3 Endurance Cup', carIds: [1] });
    expect((await request('GET', '/races/1')).body.race).toMatchObject({ championship: 'GT3 Endurance Cup' });
    expect((await request('GET', '/crews/1')).body.crew).toMatchObject({ championships: [{ championship: 'GT3 Endurance Cup', carId: null }] });

    expect((await request('PUT', '/championships/3', { ...SPRINT, name: FIE })).body.error.code).toBe('duplicate-championship-name');
    expect((await request('PUT', '/championships/99', SPRINT)).status).toBe(404);
  });

  it('una durata usata da qualche gara non si toglie e non cambia stint; le altre sì', async () => {
    await request('POST', '/championships', { ...SPRINT, durations: [{ hours: 2, stintMinutes: 60 }, { hours: 4, stintMinutes: 60 }] });
    await request('POST', '/crews', { name: 'Alfa', number: 1, ...crewDetails(1, 'GT3 Sprint Cup') });
    await request('POST', '/races', withSchedule({ championship: 'GT3 Sprint Cup', duration: 2, round: 1, trackId: null, raceDate: '2026-11-08', results: [] }));

    const removed = await request('PUT', '/championships/3', { ...SPRINT, durations: [{ hours: 4, stintMinutes: 60 }] });
    expect(removed.status).toBe(409);
    expect(removed.body.error).toEqual({ code: 'championship-duration-in-use', details: { hours: [2] } });
    expect((await request('PUT', '/championships/3', { ...SPRINT, durations: [{ hours: 2, stintMinutes: 30 }] })).status).toBe(409);
    expect((await request('PUT', '/championships/3', { ...SPRINT, durations: [{ hours: 2, stintMinutes: 60 }, { hours: 6, stintMinutes: 120 }] })).status).toBe(200);
  });

  it('eliminare: non con gare salvate; gli equipaggi perdono il campionato (e restano senza se era l\'unico)', async () => {
    await request('POST', '/championships', SPRINT);
    await request('POST', '/crews', { name: 'Alfa', number: 1, championships: [{ championship: 'GT3 Sprint Cup', carId: 1 }, { championship: FIE, carId: 1 }], color: '#E10600' });
    await request('POST', '/crews', { name: 'Beta', number: 2, ...crewDetails(1, 'GT3 Sprint Cup') });

    expect((await request('DELETE', '/championships', { ids: [3] }, 'token-steward')).status).toBe(403);
    expect((await request('DELETE', '/championships', { ids: [3] })).body).toEqual({ deletedCount: 1 });
    expect((await request('GET', '/crews/1')).body.crew.championships).toEqual([{ championship: FIE, carId: 1 }]);
    expect((await request('GET', '/crews/2')).body.crew.championships).toEqual([]);
    expect((await request('GET', '/championships')).body.championships).toHaveLength(2);

    // Il Cool1 FIE ha una gara: resta.
    await request('POST', '/races', withSchedule({ championship: FIE, duration: 6, round: 1, trackId: null, raceDate: '2026-11-08', results: [] }));
    // Tutti o nessuno: con il Cool1 FIE nella selezione non si elimina neanche l'All Japan GT.
    const blocked = await request('DELETE', '/championships', { ids: [2, 1] });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('championship-has-races');
    expect((await request('GET', '/championships')).body.championships).toHaveLength(2);
    expect((await request('DELETE', '/championships', { ids: [99] })).body).toEqual({ deletedCount: 0 });
    expect((await request('DELETE', '/championships', { ids: 'x' })).status).toBe(400);
  });
});
