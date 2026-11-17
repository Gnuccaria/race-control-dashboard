import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { createTestApp, createTestEnv, getPath, REQUIRED_DETAILS, sendJson, withSchedule, crewDetails } from './support/testApp';

const DIRECTOR = 'token-director';

describe('API penalità e cambi pilota', () => {
  let env: Env;
  let handleRequest: ReturnType<typeof createTestApp>;

  const request = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, token = DIRECTOR) => {
    const response = await handleRequest(method === 'GET' ? getPath(path, token) : sendJson(method, path, body, token), env);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  const race = (overrides: Record<string, unknown> = {}) => withSchedule({
    championship: REQUIRED_DETAILS.championship,
    duration: '6 hours',
    round: 1,
    trackId: null,
    raceDate: '2026-11-08',
    results: [{ position: 1, crewId: 1, laps: 20 }],
    ...overrides,
  });

  const penalty = (overrides: Record<string, unknown> = {}) => ({
    crews: [
      { crewId: 2, decision: 'time-5' },
      { crewId: 1, decision: null },
    ],
    violation: '2.5.1',
    document: 'code-of-conduct',
    reason: 'Spinta al via.\nNessuna posizione restituita.',
    ...overrides,
  });

  beforeEach(async () => {
    env = createTestEnv();
    handleRequest = createTestApp();
    // Due equipaggi del campionato (id 1 e 2) e uno senza campionato (id 3).
    await request('POST', '/crews', { name: 'Alfa', number: 1, ...crewDetails(1) });
    await request('POST', '/crews', { name: 'Beta', number: 2, ...crewDetails(2) });
    await env.CREWS_DB.prepare(
      "INSERT INTO crews (name, name_key, number, car_id, created_by_discord_id) VALUES ('Gamma', 'gamma', 3, 1, 'csv')",
    ).run();
    await request('POST', '/races', race());
  });

  it('aggiunge, legge, modifica ed elimina più penalità di una gara', async () => {
    const created = await request('POST', '/races/1/penalties', penalty());
    expect(created.status).toBe(201);
    expect(created.body.penalty).toMatchObject({
      id: 1,
      raceId: 1,
      crews: [
        { crewId: 1, decision: null },
        { crewId: 2, decision: 'time-5' },
      ],
      violation: '2.5.1',
      document: 'code-of-conduct',
    });
    await request('POST', '/races/1/penalties', penalty({ crews: [{ crewId: 2, decision: 'reprimand' }], reason: '' }));

    const list = await request('GET', '/races/1/penalties');
    expect((list.body.penalties as { id: number; crews: { crewId: number }[] }[]).map(({ id, crews }) => ({ id, crewIds: crews.map((crew) => crew.crewId) }))).toEqual([
      { id: 1, crewIds: [1, 2] },
      { id: 2, crewIds: [2] },
    ]);

    const updated = await request('PUT', '/races/1/penalties/1', penalty({ crews: [{ crewId: 1, decision: 'grid-3' }, { crewId: 2, decision: null }] }));
    expect(updated).toMatchObject({ status: 200, body: { penalty: { id: 1, crews: [{ crewId: 1, decision: 'grid-3' }, { crewId: 2, decision: null }] } } });
    const columns = await env.CREWS_DB.prepare('SELECT crew_id, decision FROM penalty_crews WHERE penalty_id = 1 ORDER BY crew_id').all();
    expect(columns.results).toEqual([{ crew_id: 1, decision: 'grid-3' }, { crew_id: 2, decision: null }]);
    expect((await request('GET', '/races/1/penalties/1')).body.penalty).toEqual(updated.body.penalty);

    expect(await request('DELETE', '/races/1/penalties', { ids: [1, 2, 99] })).toMatchObject({ status: 200, body: { deletedCount: 2 } });
    expect((await request('GET', '/races/1/penalties')).body.penalties).toEqual([]);
  });

  it('numera le reprimende di ogni vettura nel campionato e riparte da zero dopo la terza', async () => {
    // Gara 2 (successiva alla 1) e gara 3, corsa prima di tutte.
    await request('POST', '/races', race({ round: 2, raceDate: '2026-11-15', results: [] }));
    await request('POST', '/races', race({ round: 3, raceDate: '2026-10-01', results: [] }));
    const reprimand = (raceId: number, crewIds: number[]) =>
      request('POST', `/races/${raceId}/penalties`, penalty({ crews: crewIds.map((crewId) => ({ crewId, decision: 'reprimand' })) }));

    await reprimand(1, [1]);
    await reprimand(1, [1, 2]);
    await reprimand(2, [1]);
    await reprimand(2, [1]);
    // La gara 3 è la più vecchia: la sua reprimenda è la prima della vettura 1 e sposta tutte le altre.
    await reprimand(3, [1]);

    const numbersOf = async (raceId: number) =>
      ((await request('GET', `/races/${raceId}/penalties`)).body.penalties as { crews: { crewId: number; reprimandNumber: number | null }[] }[]).map((saved) =>
        saved.crews.map((crew) => `${crew.crewId}:${crew.reprimandNumber}`).join(' '),
      );
    expect(await numbersOf(3)).toEqual(['1:1']);
    expect(await numbersOf(1)).toEqual(['1:2', '1:3 2:1']);
    // Dopo la terza il conteggio riparte da 1.
    expect(await numbersOf(2)).toEqual(['1:1', '1:2']);

    // Conteggi per il form: reprimende già date prima di una penalità nuova o di una esistente.
    const countsOf = async (path: string) =>
      Object.fromEntries(((await request('GET', path)).body.counts as { crewId: number; count: number }[]).map(({ crewId, count }) => [crewId, count]));
    expect(await countsOf('/races/1/reprimands')).toEqual({ 1: 3, 2: 1 });
    expect(await countsOf('/races/1/reprimands?before=2')).toEqual({ 1: 2 });
    expect(await countsOf('/races/3/reprimands')).toEqual({ 1: 1 });
    expect((await request('GET', '/races/1/reprimands?before=abc')).status).toBe(400);
    expect((await request('GET', '/races/9/reprimands')).status).toBe(404);
  });

  it('rifiuta penalità incomplete, vetture di altri campionati e gare o penalità inesistenti', async () => {
    expect(await request('POST', '/races/1/penalties', penalty({ crews: [], violation: ' ', document: 'rulebook' }))).toMatchObject({
      status: 422,
      body: { error: { code: 'invalid-penalty', details: { crews: 'required', violation: 'required', document: 'invalid' } } },
    });
    // La violazione è il numero dell'articolo: solo cifre e punti.
    for (const violation of ['Contatto in curva 1', '2.4 C.d.C.', '2..4', '.2', '2,4']) {
      expect(await request('POST', '/races/1/penalties', penalty({ violation }))).toMatchObject({
        status: 422,
        body: { error: { details: { violation: 'invalid' } } },
      });
    }
    expect(await request('POST', '/races/1/penalties', penalty({ violation: ' 2.5.5.3.1 ' }))).toMatchObject({ status: 201, body: { penalty: { violation: '2.5.5.3.1' } } });
    expect(await request('POST', '/races/1/penalties', penalty({ crews: [{ crewId: 3, decision: null }] }))).toMatchObject({
      status: 422,
      body: { error: { details: { crews: 'unknown-crew' } } },
    });
    expect((await request('POST', '/races/9/penalties', penalty())).status).toBe(404);
    // Motivazione al limite (2000 caratteri accentati): accettata; oltre il limite: rifiutata.
    expect((await request('POST', '/races/1/penalties', penalty({ reason: 'è'.repeat(2000) }))).status).toBe(201);
    expect(await request('POST', '/races/1/penalties', penalty({ reason: 'è'.repeat(2001) }))).toMatchObject({
      status: 422,
      body: { error: { details: { reason: 'too-long' } } },
    });
    expect((await request('GET', '/races/1/penalties/5')).status).toBe(404);
    expect((await request('PUT', '/races/1/penalties/5', penalty())).status).toBe(404);
    expect((await request('GET', '/races/1/penalties', undefined, 'token-no-role')).status).toBe(403);
  });

  it('accetta una gara con classifica piena e tutti i cambi pilota compilati', async () => {
    const crewIds: number[] = [];
    for (let number = 10; number < 22; number++) {
      const created = await request('POST', '/crews', { name: `Squadra ${number}`, number, ...crewDetails(1) });
      crewIds.push((created.body.crew as { id: number }).id);
    }
    const allCrewIds = [1, 2, ...crewIds];
    const results = allCrewIds.map((crewId, index) => ({ position: index + 1, crewId, laps: 200 - index, gapMs: index === 0 ? null : 600_000 + index }));
    const driverSwaps = [1, 2, 3, 4, 5].flatMap((swap) =>
      allCrewIds.map((crewId) => ({ swap, crewId, pitInMs: 8_000_000 + crewId, pitOutMs: 900_000, isCancelled: false, notes: 'è'.repeat(120) })),
    );
    expect((await request('PUT', '/races/1', race({ totalLaps: null, results }))).status).toBe(200);
    // I cambi pilota si salvano a parte (Gestisci cambi pilota dei Commissari Sportivi).
    const saved = await request('PUT', '/races/1/driver-swaps', { driverSwaps });
    expect(saved.status).toBe(200);
    expect((saved.body.race as { driverSwaps: unknown[] }).driverSwaps).toHaveLength(70);
  });

  it('salva tutte le righe dei cambi pilota (a parte dalla gara), con la penalità ricalcolata dal server', async () => {
    const driverSwaps = [
      { swap: 1, crewId: 1, pitInMs: 3_600_000, pitOutMs: 600_000, isCancelled: false, notes: '' },
      { swap: 1, crewId: 2, pitInMs: 3_610_000, pitOutMs: 605_000, isCancelled: true, notes: 'Crash, penalità annullata', penaltyMs: 1 },
      { swap: 2, crewId: 2, pitInMs: null, pitOutMs: 700_000, isCancelled: false, notes: '' },
    ];
    const saved = await request('PUT', '/races/1/driver-swaps', { driverSwaps });
    expect(saved.status).toBe(200);
    expect(saved.body.race).toMatchObject({
      driverSwaps: [
        { swap: 1, crewId: 1, pitInMs: 3_600_000, pitOutMs: 600_000, penaltyMs: null, isCancelled: false, notes: '' },
        // 2,5 × (10 s − 5 s − 2 s): il valore mandato dall'app (1) non conta.
        { swap: 1, crewId: 2, pitInMs: 3_610_000, pitOutMs: 605_000, penaltyMs: 7_500, isCancelled: true, notes: 'Crash, penalità annullata' },
        { swap: 2, crewId: 2, pitInMs: null, pitOutMs: 700_000, penaltyMs: null, isCancelled: false, notes: '' },
      ],
    });
    const columns = await env.CREWS_DB.prepare('SELECT * FROM driver_swaps WHERE swap = 1 AND crew_id = 2').first();
    expect(columns).toEqual({ race_id: 1, swap: 1, crew_id: 2, pit_in: 3_610_000, pit_out: 605_000, penalty: 7_500, is_cancelled: 1, notes: 'Crash, penalità annullata' });

    // Salvando la gara intera i cambi pilota restano quelli salvati.
    expect((await request('PUT', '/races/1', race({ driverSwaps: [] }))).body.race).toMatchObject({ driverSwaps: [{ swap: 1 }, { swap: 1 }, { swap: 2 }] });
    const replaced = await request('PUT', '/races/1/driver-swaps', { driverSwaps: [] });
    expect(replaced.body.race).toMatchObject({ driverSwaps: [] });
    // Vetture di un altro campionato, cambi oltre quelli del campionato (5 nel Cool1 FIE) o righe ripetute: rifiutate.
    const row = { swap: 1, crewId: 2, pitInMs: 1, pitOutMs: 1, isCancelled: false, notes: '' };
    expect((await request('PUT', '/races/1/driver-swaps', { driverSwaps: [{ ...row, crewId: 3 }] })).status).toBe(422);
    expect((await request('PUT', '/races/1/driver-swaps', { driverSwaps: [{ ...row, swap: 6 }] })).status).toBe(422);
    expect((await request('PUT', '/races/1/driver-swaps', { driverSwaps: [row, row] })).status).toBe(422);
  });

  it('eliminando la gara elimina penalità e cambi pilota; un equipaggio coinvolto non si elimina', async () => {
    await request('POST', '/races', race({ round: 2, results: [], driverSwaps: [{ swap: 1, crewId: 2, pitInMs: 1, pitOutMs: 2, isCancelled: false, notes: '' }] }));
    await request('POST', '/races/2/penalties', penalty({ crews: [{ crewId: 2, decision: null }] }));
    // L'equipaggio 2 non è in nessuna classifica, ma ha una penalità e un cambio pilota.
    expect((await request('DELETE', '/crews', { ids: [2] })).status).toBe(409);

    expect(await request('DELETE', '/races', { ids: [2] })).toMatchObject({ status: 200, body: { deletedCount: 1 } });
    const leftovers = await env.CREWS_DB.prepare(
      'SELECT (SELECT COUNT(*) FROM penalties) AS penalties, (SELECT COUNT(*) FROM penalty_crews) AS crews, (SELECT COUNT(*) FROM driver_swaps) AS swaps',
    ).first();
    expect(leftovers).toEqual({ penalties: 0, crews: 0, swaps: 0 });
    expect(await request('DELETE', '/crews', { ids: [2] })).toMatchObject({ status: 200, body: { deletedCount: 1 } });
  });

  it('eliminando più gare cancella tutti i loro dati e lascia intatti quelli delle altre', async () => {
    await request('POST', '/races', race({ round: 2, driverSwaps: [{ swap: 1, crewId: 2, pitInMs: 1, pitOutMs: 2, isCancelled: false, notes: 'x' }] }));
    await request('POST', '/races', race({ round: 3, driverSwaps: [{ swap: 1, crewId: 1, pitInMs: 1, pitOutMs: 2, isCancelled: false, notes: '' }] }));
    await request('POST', '/races/1/penalties', penalty());
    await request('POST', '/races/2/penalties', penalty({ crews: [{ crewId: 1, decision: 'reprimand' }, { crewId: 2, decision: null }] }));
    await request('POST', '/races/3/penalties', penalty({ crews: [{ crewId: 2, decision: 'time-5' }] }));

    expect(await request('DELETE', '/races', { ids: [2, 3] })).toMatchObject({ status: 200, body: { deletedCount: 2 } });
    const countsByRace = await env.CREWS_DB.prepare(
      `SELECT r.id AS raceId,
              (SELECT COUNT(*) FROM race_results WHERE race_id = r.id) AS results,
              (SELECT COUNT(*) FROM driver_swaps WHERE race_id = r.id) AS swaps,
              (SELECT COUNT(*) FROM penalties WHERE race_id = r.id) AS penalties
       FROM (SELECT 1 AS id UNION SELECT 2 UNION SELECT 3) AS r ORDER BY r.id`,
    ).all();
    const [race1, race2, race3] = countsByRace.results.map((row) => ({ ...row }) as Record<string, number>);
    expect(race1?.penalties).toBe(1);
    expect((race1?.results ?? 0) > 0).toBe(true);
    expect(race2).toEqual({ raceId: 2, results: 0, swaps: 0, penalties: 0 });
    expect(race3).toEqual({ raceId: 3, results: 0, swaps: 0, penalties: 0 });
    // Nessuna vettura di penalità rimasta senza la sua penalità.
    const orphans = await env.CREWS_DB.prepare('SELECT COUNT(*) AS count FROM penalty_crews WHERE penalty_id NOT IN (SELECT id FROM penalties)').first();
    expect(orphans).toEqual({ count: 0 });
    expect(await request('GET', '/races/1/penalties')).toMatchObject({ status: 200 });
  });

  describe('traduzione inglese', () => {
    /** Modello finto: "EN(testo)" con i segnaposto intatti; conta le chiamate. */
    let modelCalls = 0;
    const englishOf = (penaltyBody: Record<string, unknown>) => (penaltyBody.penalty as { english: unknown }).english;

    beforeEach(() => {
      modelCalls = 0;
      env = {
        ...env,
        AI: {
          run(_model, inputs) {
            modelCalls += 1;
            const messages = inputs.messages as { content: string }[];
            const { reason } = JSON.parse(messages.at(-1)?.content ?? '{}') as { reason: string };
            return Promise.resolve({ response: { reason: `EN(${reason})` } });
          },
        },
      };
    });

    it('traduce alla creazione e salva la traduzione automatica', async () => {
      const created = await request('POST', '/races/1/penalties', penalty({ reason: 'la vettura #2 rientra (Reg. Tec.)' }));
      expect(englishOf(created.body)).toEqual({
        reason: 'EN(la vettura #2 rientra (Tech. Reg.))',
        source: 'automatic',
        isOutdated: false,
      });
      const read = await request('GET', '/races/1/penalties/1');
      expect(englishOf(read.body)).toMatchObject({ source: 'automatic' });
    });

    it('rifà la traduzione automatica solo quando cambia il testo originale', async () => {
      await request('POST', '/races/1/penalties', penalty());
      expect(modelCalls).toBe(1);
      await request('PUT', '/races/1/penalties/1', penalty({ crews: [{ crewId: 1, decision: 'grid-1' }] }));
      expect(modelCalls).toBe(1);
      const updated = await request('PUT', '/races/1/penalties/1', penalty({ reason: 'Nuova motivazione' }));
      expect(modelCalls).toBe(2);
      expect(englishOf(updated.body)).toMatchObject({ reason: 'EN(Nuova motivazione)', source: 'automatic' });
    });

    it('tiene la correzione a mano, la segnala se cambia l’originale e la rifà su richiesta', async () => {
      await request('POST', '/races/1/penalties', penalty());
      const corrected = await request('PUT', '/races/1/penalties/1', penalty({ englishText: { reason: ' Pushed at the start. ' } }));
      expect(englishOf(corrected.body)).toEqual({ reason: 'Pushed at the start.', source: 'manual', isOutdated: false });

      // Cambiano articolo e documento: la motivazione è la stessa, la traduzione resta com'è.
      const sameReason = await request('PUT', '/races/1/penalties/1', penalty({ violation: '3.1', document: 'technical-regulations' }));
      expect(englishOf(sameReason.body)).toEqual({ reason: 'Pushed at the start.', source: 'manual', isOutdated: false });

      const changed = await request('PUT', '/races/1/penalties/1', penalty({ reason: 'Spinta in curva 2' }));
      expect(englishOf(changed.body)).toEqual({ reason: 'Pushed at the start.', source: 'manual', isOutdated: true });
      expect(modelCalls).toBe(1);

      const redone = await request('PUT', '/races/1/penalties/1', penalty({ reason: 'Spinta in curva 2', englishText: null }));
      expect(englishOf(redone.body)).toMatchObject({ reason: 'EN(Spinta in curva 2)', source: 'automatic', isOutdated: false });
    });

    it('rifiuta una traduzione a mano vuota', async () => {
      await request('POST', '/races/1/penalties', penalty());
      const rejected = await request('PUT', '/races/1/penalties/1', penalty({ englishText: { reason: '  ' } }));
      expect(rejected.status).toBe(422);
    });

    it('senza Workers AI salva comunque la penalità, senza traduzione', async () => {
      env = { ...env, AI: undefined };
      const created = await request('POST', '/races/1/penalties', penalty());
      expect(created.status).toBe(201);
      expect(englishOf(created.body)).toBeNull();
    });
  });
});
