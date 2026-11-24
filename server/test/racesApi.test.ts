import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { allowCarIn, createTestApp, createTestEnv, crewDetails, getPath, readError, sendJson, withSchedule } from './support/testApp';

const DIRECTOR = 'token-director';
const CHAMPIONSHIP = 'Cool1 FIE Championship';

describe('API gare e piste', () => {
  let env: Env;
  let handleRequest: ReturnType<typeof createTestApp>;

  const request = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown, token = DIRECTOR) => {
    const response = await handleRequest(method === 'GET' ? getPath(path, token) : sendJson(method, path, body, token), env);
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  const race = (overrides: Record<string, unknown> = {}) => withSchedule({
    name: 'Gara di prova',
    championship: CHAMPIONSHIP,
    duration: 6,
    totalLaps: 30,
    round: 1,
    trackId: null,
    raceDate: '2026-11-08',
    // Il secondo arriva a 1:05,320 dal leader (in millisecondi); il primo non ha distacco.
    results: [
      { position: 1, crewId: 2, laps: 29 },
      { position: 2, crewId: 1, laps: 28, gapMs: 65320 },
    ],
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
  });

  it('salva le qualifiche con la vettura di ogni riga, le mostra sul sito e le ricontrolla', async () => {
    const qualifying = [
      { position: 1, crewId: 1, q1Ms: 118_432, q2Ms: 117_905 },
      { position: 2, crewId: 2, q1Ms: 118_900, q2Ms: null },
    ];
    const created = await request('POST', '/races', race({ qualifying }));
    expect(created.status).toBe(201);
    expect((created.body.race as { qualifying: unknown }).qualifying).toEqual([
      { position: 1, crewId: 1, q1Ms: 118_432, q2Ms: 117_905, carId: 1 },
      { position: 2, crewId: 2, q1Ms: 118_900, q2Ms: null, carId: 2 },
    ]);
    const raceId = (created.body.race as { id: number }).id;
    const publicRace = (await (await handleRequest(new Request(`https://race-control-api.test/public/races/${raceId}`), env)).json()) as { race: { qualifying: unknown[] } };
    expect(publicRace.race.qualifying[0]).toMatchObject({ position: 1, crewNumber: 1, crewName: 'Alfa', q1Ms: 118_432, q2Ms: 117_905 });

    // Q2 solo nelle posizioni 1–4 e 8–11; un equipaggio una volta sola; solo equipaggi del campionato.
    expect((await request('PUT', `/races/${raceId}`, race({ qualifying: [{ position: 5, crewId: 1, q1Ms: 118_000, q2Ms: 117_000 }] }))).body).toMatchObject({
      error: { code: 'invalid-race', details: { qualifying: 'invalid' } },
    });
    expect((await request('PUT', `/races/${raceId}`, race({ qualifying: [{ position: 1, crewId: 1 }, { position: 2, crewId: 1 }] }))).body).toMatchObject({
      error: { details: { qualifying: 'repeated-crew' } },
    });
    expect((await request('PUT', `/races/${raceId}`, race({ qualifying: [{ position: 1, crewId: 3 }] }))).status).toBe(422);

    // Un equipaggio presente solo nelle qualifiche non si può eliminare.
    expect((await request('PUT', `/races/${raceId}`, race({ results: [{ position: 1, crewId: 2, laps: 29 }], qualifying }))).status).toBe(200);
    expect((await request('DELETE', '/crews', { ids: [1] })).status).toBe(409);
    // Senza il campo qualifiche (app non ancora aggiornata) restano quelle salvate; con un elenco vuoto si tolgono.
    expect(((await request('PUT', `/races/${raceId}`, race())).body.race as { qualifying: unknown[] }).qualifying).toHaveLength(2);
    expect(((await request('PUT', `/races/${raceId}`, race({ qualifying: [] }))).body.race as { qualifying: unknown[] }).qualifying).toEqual([]);
  });

  it('salva una gara con il suo ordine di arrivo e la restituisce', async () => {
    const created = await request('POST', '/races', race());
    expect(created.status).toBe(201);
    expect(created.body.race).toMatchObject({
      id: 1,
      name: 'Gara di prova',
      championship: CHAMPIONSHIP,
      duration: 6,
      totalLaps: 30,
      round: 1,
      trackName: null,
      raceDate: '2026-11-08',
      // Ogni riga salva l'auto che l'equipaggio ha in quel momento.
      results: [
        { position: 1, crewId: 2, laps: 29, gapMs: null, carId: 2 },
        { position: 2, crewId: 1, laps: 28, gapMs: 65320, carId: 1 },
      ],
    });

    const detail = await request('GET', '/races/1');
    expect(detail.body.race).toEqual(created.body.race);
  });

  it('elenca le gare dalla più recente', async () => {
    await request('POST', '/races', race({ round: 1, raceDate: '2026-10-01' }));
    await request('POST', '/races', race({ round: 2, raceDate: '2026-11-01' }));
    const list = await request('GET', '/races');
    expect((list.body.races as { round: number }[]).map((summary) => summary.round)).toEqual([2, 1]);
  });

  it('rifiuta round già usato, equipaggi ripetuti o di un altro campionato, pista inesistente', async () => {
    await request('POST', '/races', race());

    const sameRound = await handleRequest(sendJson('POST', '/races', race({ raceDate: '2026-10-20' }), DIRECTOR), env);
    // Le gare si inseriscono anche in anticipo, con gli orari obbligatori.
    const futureRace = await request('POST', '/races', race({ round: 3, raceDate: '2099-01-01', results: [] }));
    expect(futureRace).toMatchObject({ status: 201, body: { race: { raceDate: '2099-01-01', startTime: '21:00', endDate: '2099-01-01', endTime: '23:30' } } });
    const withoutTimes = await request('POST', '/races', { ...race({ round: 4 }), startTime: undefined });
    expect(withoutTimes).toMatchObject({ status: 422, body: { error: { details: { startTime: 'invalid' } } } });
    expect(sameRound.status).toBe(409);
    expect(await readError(sameRound)).toBe('duplicate-race-round');

    const repeated = await request('POST', '/races', race({ round: 2, results: [{ position: 1, crewId: 1, laps: 29 }, { position: 2, crewId: 1, laps: 28 }] }));
    expect(repeated).toMatchObject({ status: 422, body: { error: { code: 'invalid-race', details: { results: 'repeated-crew' } } } });

    const outsider = await request('POST', '/races', race({ round: 2, results: [{ position: 1, crewId: 3, laps: 29 }] }));
    expect(outsider).toMatchObject({ status: 422, body: { error: { details: { results: 'unknown-crew' } } } });

    const unknownTrack = await request('POST', '/races', race({ round: 2, trackId: 99 }));
    expect(unknownTrack).toMatchObject({ status: 422, body: { error: { details: { trackId: 'unknown-track' } } } });
  });

  it('modifica dati e ordine di arrivo e aggiorna la data di ultima modifica', async () => {
    const created = await request('POST', '/races', race());
    const updated = await request('PUT', '/races/1', race({ round: 4, results: [{ position: 1, crewId: 1, laps: 29 }] }));
    expect(updated.status).toBe(200);
    expect(updated.body.race).toMatchObject({ round: 4, results: [{ position: 1, crewId: 1, laps: 29 }] });
    expect((updated.body.race as { updatedAt: string }).updatedAt >= (created.body.race as { updatedAt: string }).updatedAt).toBe(true);

    expect((await request('PUT', '/races/99', race())).status).toBe(404);
  });

  it('elimina le gare selezionate con le loro classifiche', async () => {
    await request('POST', '/races', race({ round: 1 }));
    await request('POST', '/races', race({ round: 2 }));
    const deleted = await request('DELETE', '/races', { ids: [1, 99] });
    expect(deleted.body).toEqual({ deletedCount: 1 });
    expect((await request('GET', '/races')).body.races).toHaveLength(1);
    const remainingResults = await env.CREWS_DB.prepare('SELECT COUNT(*) AS resultCount FROM race_results').first<{
      resultCount: number;
    }>();
    expect(remainingResults?.resultCount).toBe(2);
  });

  it('un equipaggio presente in un ordine di arrivo non si può eliminare', async () => {
    await request('POST', '/races', race());
    const response = await handleRequest(sendJson('DELETE', '/crews', { ids: [1] }, DIRECTOR), env);
    expect(response.status).toBe(409);
    expect(await readError(response)).toBe('crew-in-race-results');
    expect((await request('DELETE', '/crews', { ids: [3] })).body).toEqual({ deletedCount: 1 });
  });

  it('restituisce le auto della tabella cars, con i dati tecnici ancora vuoti', async () => {
    const cars = (await request('GET', '/cars')).body.cars as { manufacturer: string; model: string | null; horsepower: number | null }[];
    expect(cars.map((car) => car.manufacturer)).toEqual(['Audi', 'BMW', 'Ferrari', 'Lamborghini', 'Nissan', 'Porsche']);
    expect(cars[0]).toEqual({
      id: 1,
      manufacturer: 'Audi',
      model: null,
      group: null,
      horsepower: null,
      weightKg: null,
      drivetrain: null,
      bopHorsepower: null,
      bopWeightKg: null,
      limiter: null,
      ballastKg: null,
      championships: ['Cool1 FIE Championship'],
    });
    expect((await request('GET', '/cars', undefined, 'token-no-role')).status).toBe(403);
  });

  it('salva i giri completati e rifiuta classifiche senza giri', async () => {
    const created = await request('POST', '/races', race());
    expect((created.body.race as { results: unknown[] }).results).toEqual([
      { position: 1, crewId: 2, laps: 29, gapMs: null, carId: 2 },
      { position: 2, crewId: 1, laps: 28, gapMs: 65320, carId: 1 },
    ]);
    const withoutLaps = await request('POST', '/races', race({ round: 2, results: [{ position: 1, crewId: 1 }] }));
    expect(withoutLaps).toMatchObject({ status: 422, body: { error: { details: { results: 'invalid' } } } });
  });

  it('piste: elenco alfabetico (arrivano solo dall\'aggiornamento dai siti), uso nelle gare', async () => {
    await env.CREWS_DB.prepare(
      "INSERT INTO tracks (id, name, name_key, configuration, country, length_meters, has_reverse_layout, map_file) VALUES (1, 'Spa-Francorchamps', 'spa-francorchamps|full course', 'Full Course', 'BE', 7044, 0, 'spa-francorchamps.png'), (2, 'Monza', 'monza|full course', 'Full Course', 'IT', 5793, 0, NULL)",
    ).run();
    expect((await request('POST', '/tracks', { name: 'Imola' })).status).toBe(405);
    const trackList = (await request('GET', '/tracks')).body.tracks as unknown[];
    expect(trackList).toEqual([
      { id: 2, name: 'Monza', configuration: 'Full Course', country: 'IT', lengthMeters: 5793, hasReverseLayout: false, mapFile: null, reverseMapFile: null },
      { id: 1, name: 'Spa-Francorchamps', configuration: 'Full Course', country: 'BE', lengthMeters: 7044, hasReverseLayout: false, mapFile: 'spa-francorchamps.png', reverseMapFile: null },
    ]);

    const withTrack = await request('POST', '/races', race({ trackId: 2 }));
    expect(withTrack.body.race).toMatchObject({ trackId: 2, trackName: 'Monza' });

    // Al contrario solo se la configurazione lo prevede; nome e configurazione arrivano separati, l'app li traduce.
    const withTrackId = (withTrack.body.race as { id: number }).id;
    expect((await request('PUT', `/races/${withTrackId}`, race({ trackId: 2, isTrackReversed: true }))).body).toMatchObject({
      error: { code: 'invalid-race', details: { trackId: 'reverse-unavailable' } },
    });
    await env.CREWS_DB.prepare("INSERT INTO tracks (id, name, name_key, configuration, has_reverse_layout) VALUES (9, 'Alsace', 'alsace|village', 'Village', 1)").run();
    const reversed = await request('POST', '/races', race({ round: 2, trackId: 9, isTrackReversed: true }));
    expect(reversed).toMatchObject({ status: 201, body: { race: { trackId: 9, trackName: 'Alsace', trackConfiguration: 'Village', isTrackReversed: true } } });
  });

  it('tutte le richieste su gare e piste richiedono login e ruolo', async () => {
    expect((await request('GET', '/races', undefined, '')).status).toBe(401);
    expect((await request('POST', '/races', race(), 'token-no-role')).status).toBe(403);
    expect((await request('GET', '/tracks', undefined, 'token-no-role')).status).toBe(403);
    expect((await request('DELETE', '/races', { ids: [1] }, '')).status).toBe(401);
  });

  it('la gara salvata tiene l\'auto usata anche se poi l\'equipaggio la cambia', async () => {
    await request('POST', '/races', race());
    // L'equipaggio 2 (Beta) passa dall'auto 2 alla 5.
    await request('PUT', '/crews/2', { name: 'Beta', number: 2, ...crewDetails(5) });

    // Modifica che lascia Beta in P1: la sua riga tiene l'auto 2.
    const lapsOnly = await request('PUT', '/races/1', race({ results: [{ position: 1, crewId: 2, laps: 30 }, { position: 2, crewId: 1, laps: 28 }] }));
    expect((lapsOnly.body.race as { results: unknown[] }).results).toEqual([
      { position: 1, crewId: 2, laps: 30, gapMs: null, carId: 2 },
      { position: 2, crewId: 1, laps: 28, gapMs: null, carId: 1 },
    ]);
    // Beta cambia posizione: ora la sua riga prende l'auto attuale (5).
    const swapped = await request('PUT', '/races/1', race({ results: [{ position: 1, crewId: 1, laps: 30 }, { position: 2, crewId: 2, laps: 29 }] }));
    expect((swapped.body.race as { results: unknown[] }).results).toEqual([
      { position: 1, crewId: 1, laps: 30, gapMs: null, carId: 1 },
      { position: 2, crewId: 2, laps: 29, gapMs: null, carId: 5 },
    ]);
    // Le gare nuove usano già l'auto aggiornata.
    const nextRace = await request('POST', '/races', race({ round: 2 }));
    expect((nextRace.body.race as { results: { carId: number }[] }).results[0]?.carId).toBe(5);
  });

  it('rifiuta distacchi non validi', async () => {
    for (const gapMs of [-1, 1.5, 60_000_000, '1:05,320']) {
      const response = await request('POST', '/races', race({ results: [{ position: 1, crewId: 2, laps: 29 }, { position: 2, crewId: 1, laps: 28, gapMs }] }));
      expect(response.status).toBe(422);
    }
    // Il primo non ha distacco: è il riferimento degli altri.
    expect((await request('POST', '/races', race({ results: [{ position: 1, crewId: 2, laps: 29, gapMs: 1000 }] }))).status).toBe(422);
  });

  it('un equipaggio in più campionati corre con l’auto del campionato della gara', async () => {
    await allowCarIn(env, 5, 'All Japan GT Championship');
    // L'equipaggio 1 ha l'Audi nel Cool1 FIE e la Nissan nell'All Japan GT.
    await env.CREWS_DB.prepare("INSERT INTO crew_championships (crew_id, championship, car_id) VALUES (1, 'All Japan GT Championship', 5)").run();
    const japanRace = await request(
      'POST',
      '/races',
      race({ championship: 'All Japan GT Championship', duration: 3, round: 1, results: [{ position: 1, crewId: 1, laps: 25 }], driverSwaps: [] }),
    );
    expect(japanRace.status).toBe(201);
    expect((japanRace.body.race as { results: { carId: number }[] }).results[0]?.carId).toBe(5);
    // L'equipaggio 2 non partecipa all'All Japan GT.
    const outsider = await request('POST', '/races', race({ championship: 'All Japan GT Championship', duration: 3, round: 2, results: [{ position: 1, crewId: 2, laps: 25 }] }));
    expect(outsider).toMatchObject({ status: 422 });
  });

  it('rifiuta un equipaggio senza auto e una gara senza durata', async () => {
    await env.CREWS_DB.prepare("UPDATE crew_championships SET car_id = NULL WHERE crew_id = 1").run();
    expect((await request('POST', '/races', race())).body).toMatchObject({
      error: { code: 'invalid-race', details: { results: 'crew-without-car', positions: [2] } },
    });
    expect((await request('POST', '/races', race({ duration: null, results: [] }))).body).toMatchObject({
      error: { code: 'invalid-race', details: { duration: 'required' } },
    });
  });

  it('il sito legge gare e classifiche senza accesso, ma non può modificarle', async () => {
    await request('POST', '/races', race());

    // Nessun token: le letture pubbliche funzionano e si possono tenere in cache per un minuto.
    const list = await handleRequest(getPath('/public/races'), env);
    expect(list.status).toBe(200);
    expect(list.headers.get('Cache-Control')).toContain('public');
    expect(((await list.json()) as { races: { name: string }[] }).races.map((saved) => saved.name)).toEqual(['Gara di prova']);

    const detail = await handleRequest(getPath('/public/races/1'), env);
    const body = (await detail.json()) as { race: Record<string, unknown> };
    expect(body.race).toMatchObject({ name: 'Gara di prova', totalLaps: 30, championship: CHAMPIONSHIP, round: 1 });
    // Classifica con numero, nome e colore dell'equipaggio e nome della vettura usata; nessun id Discord.
    expect(body.race.results).toEqual([
      { position: 1, laps: 29, gapMs: null, crewNumber: 2, crewName: 'Beta', crewColor: '#E10600', carName: 'BMW', penaltyMs: null },
      { position: 2, laps: 28, gapMs: 65320, crewNumber: 1, crewName: 'Alfa', crewColor: '#E10600', carName: 'Audi', penaltyMs: null },
    ]);
    expect(JSON.stringify(body).includes('discord')).toBe(false);

    expect((await handleRequest(getPath('/public/races/99'), env)).status).toBe(404);
    expect((await handleRequest(sendJson('POST', '/public/races', race()), env)).status).toBe(405);
    // Le API dell'app restano protette.
    expect((await handleRequest(getPath('/races'), env)).status).toBe(401);
  });

  it('le gare inserite in anticipo compaiono sul sito (meteo e documentazione), con la classifica vuota', async () => {
    await request('POST', '/races', race());
    await request('POST', '/races', race({ round: 2, name: 'Gara futura', raceDate: '2099-01-01', results: [] }));
    const list = (await (await handleRequest(getPath('/public/races'), env)).json()) as { races: { name: string }[] };
    expect(list.races.map((saved) => saved.name)).toEqual(['Gara futura', 'Gara di prova']);
    const future = (await (await handleRequest(getPath('/public/races/2'), env)).json()) as { race: { results: unknown[]; weather: unknown } };
    expect(future.race).toMatchObject({ results: [], weather: { stintCount: 6, pattern: null } });
    expect((await handleRequest(getPath('/public/races/2/report.pdf'), env)).status).toBe(200);
    expect(((await request('GET', '/races')).body.races as unknown[]).length).toBe(2);
  });
});
