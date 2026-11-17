import { beforeEach, describe, expect, it } from 'vitest';
import { checkDiscordMembership, clearVerifiedMembershipsForTests } from '../src/auth/discordMembership';
import type { Env } from '../src/env';
import {
  allowCarIn,
  crewDetails,
  authorizationHeader,
  createTestApp,
  createTestEnv,
  getPath,
  MEMBERSHIPS,
  readError,
  REQUIRED_DETAILS,
  sendJson,
} from './support/testApp';

const REQUIRED_ROLE_ID = 'role-race-control';
const VALID_CREW = { name: 'Team Rosso', number: 44, ...crewDetails(3) };

const postCrew = (body: unknown, accessToken?: string) => sendJson('POST', '/crews', body, accessToken);
const putCrew = (crewId: number, body: unknown, accessToken?: string) => sendJson('PUT', `/crews/${crewId}`, body, accessToken);

describe('POST /crews', () => {
  let env: Env;
  let handleRequest: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    env = createTestEnv();
    handleRequest = createTestApp(MEMBERSHIPS);
  });

  it("salva l'equipaggio e registra chi l'ha creato", async () => {
    const response = await handleRequest(postCrew(VALID_CREW, 'token-director'), env);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ crew: { id: 1, ...VALID_CREW } });
    const savedRow = await env.CREWS_DB.prepare('SELECT created_by_discord_id FROM crews').first<{ created_by_discord_id: string }>();
    expect(savedRow?.created_by_discord_id).toBe('discord-42');
  });

  it('rifiuta chi non ha effettuato il login', async () => {
    const response = await handleRequest(postCrew(VALID_CREW), env);
    expect(response.status).toBe(401);
    expect(await readError(response)).toBe('not-signed-in');
  });

  it('rifiuta un token che Discord non riconosce', async () => {
    const response = await handleRequest(postCrew(VALID_CREW, 'token-falso'), env);
    expect(response.status).toBe(401);
  });

  it('rifiuta chi non ha il ruolo richiesto', async () => {
    const response = await handleRequest(postCrew(VALID_CREW, 'token-no-role'), env);
    expect(response.status).toBe(403);
    expect(await readError(response)).toBe('missing-role');
  });

  it('segnala quando Discord non è raggiungibile', async () => {
    const response = await handleRequest(postCrew(VALID_CREW, 'token-discord-down'), env);
    expect(response.status).toBe(503);
  });

  it("ricontrolla i dati anche se l'app li ha già convalidati", async () => {
    const response = await handleRequest(
      postCrew({ name: 'Team-Rosso', number: 1000, championships: [{ championship: REQUIRED_DETAILS.championship, carId: 'Fiat' }], color: '#E10600' }, 'token-director'),
      env,
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: 'invalid-crew', details: { name: 'invalid-characters', number: 'invalid', championships: 'car-invalid' } },
    });
  });

  it("rifiuta un'auto che non esiste o che non è disponibile nel campionato", async () => {
    const unknown = await handleRequest(postCrew({ ...VALID_CREW, ...crewDetails(99) }, 'token-director'), env);
    expect(unknown.status).toBe(422);
    expect(await unknown.json()).toEqual({ error: { code: 'invalid-crew', details: { championships: 'unknown-car' } } });
    // Le auto della migrazione sono solo del Cool1 FIE: nell'All Japan GT servono auto di quel campionato.
    const wrongChampionship = await handleRequest(postCrew({ ...VALID_CREW, ...crewDetails(1, 'All Japan GT Championship') }, 'token-director'), env);
    expect(await wrongChampionship.json()).toEqual({ error: { code: 'invalid-crew', details: { championships: 'unknown-car' } } });
    await allowCarIn(env, 1, 'All Japan GT Championship');
    expect((await handleRequest(postCrew({ ...VALID_CREW, ...crewDetails(1, 'All Japan GT Championship') }, 'token-director'), env)).status).toBe(201);
  });

  it('un equipaggio può partecipare a più campionati, ognuno con la sua auto, oppure a nessuno', async () => {
    await allowCarIn(env, 3, 'All Japan GT Championship');
    const both = await handleRequest(
      postCrew(
        {
          name: 'Doppio Team',
          number: 9,
          championships: [
            { championship: 'All Japan GT Championship', carId: 3 },
            { championship: 'Cool1 FIE Championship', carId: 1 },
          ],
          color: '#123456',
        },
        'token-director',
      ),
      env,
    );
    expect(both.status).toBe(201);
    // In ordine di campionato.
    expect(await both.json()).toMatchObject({
      crew: {
        championships: [
          { championship: 'Cool1 FIE Championship', carId: 1 },
          { championship: 'All Japan GT Championship', carId: 3 },
        ],
      },
    });
    const none = await handleRequest(postCrew({ name: 'Senza Campionato', number: 10, championships: [], color: '#123456' }, 'token-director'), env);
    expect(await none.json()).toMatchObject({ crew: { championships: [] } });
    const repeated = await handleRequest(
      postCrew({ name: 'Ripetuto', number: 11, championships: [{ championship: REQUIRED_DETAILS.championship, carId: 1 }, { championship: REQUIRED_DETAILS.championship, carId: 2 }], color: '#123456' }, 'token-director'),
      env,
    );
    expect(await repeated.json()).toEqual({ error: { code: 'invalid-crew', details: { championships: 'repeated' } } });
    const withoutCar = await handleRequest(postCrew({ name: 'Senza Auto', number: 12, championships: [{ championship: REQUIRED_DETAILS.championship }], color: '#123456' }, 'token-director'), env);
    expect(await withoutCar.json()).toEqual({ error: { code: 'invalid-crew', details: { championships: 'car-required' } } });
  });

  it("dall'API il colore è obbligatorio", async () => {
    const response = await handleRequest(postCrew({ name: 'Team Blu', number: 5 }, 'token-director'), env);
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { code: 'invalid-crew', details: { color: 'required' } } });
  });


  it('rifiuta JSON non valido e richieste troppo grandi', async () => {
    expect((await handleRequest(postCrew('{non json', 'token-director'), env)).status).toBe(400);
    expect((await handleRequest(postCrew({ ...VALID_CREW, padding: 'x'.repeat(3000) }, 'token-director'), env)).status).toBe(400);
  });

  it('non accetta due equipaggi con lo stesso numero', async () => {
    await handleRequest(postCrew(VALID_CREW, 'token-director'), env);
    const response = await handleRequest(postCrew({ name: 'Team Blu', number: 44, ...crewDetails(2) }, 'token-director'), env);

    expect(response.status).toBe(409);
    expect(await readError(response)).toBe('duplicate-crew-number');
  });

  it('non accetta due equipaggi con lo stesso nome, anche con maiuscole o spazi diversi', async () => {
    await handleRequest(postCrew(VALID_CREW, 'token-director'), env);
    const response = await handleRequest(postCrew({ name: ' team  ROSSO ', number: 7, ...crewDetails(1) }, 'token-director'), env);

    expect(response.status).toBe(409);
    expect(await readError(response)).toBe('duplicate-crew-name');
  });

  it('risponde 404 e 405 per percorsi e metodi sconosciuti', async () => {
    expect((await handleRequest(new Request('https://race-control-api.test/altro'), env)).status).toBe(404);
    expect((await handleRequest(new Request('https://race-control-api.test/crews', { method: 'PATCH' }), env)).status).toBe(405);
    expect((await handleRequest(new Request('https://race-control-api.test/crews/abc'), env)).status).toBe(404);
  });
});

describe('verifica del ruolo su Discord', () => {
  const settings = { guildId: 'guild-1', organizationRoleId: 'role-organization', raceControlRoleId: REQUIRED_ROLE_ID, stewardsRoleId: 'role-stewards' };
  const discordAnswering = (status: number, body: unknown = {}) => () =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));

  beforeEach(() => {
    clearVerifiedMembershipsForTests();
  });

  it('riconosce un membro con il ruolo', async () => {
    const fetchFromDiscord = discordAnswering(200, { user: { id: 'discord-42', username: 'niko' }, roles: [REQUIRED_ROLE_ID] });
    expect(await checkDiscordMembership('token-a', settings, fetchFromDiscord)).toEqual({
      status: 'member-with-role',
      discordUserId: 'discord-42',
      access: { organization: false, raceControl: true, stewards: false },
    });
    const steward = discordAnswering(200, { user: { id: 'discord-44', username: 'luca' }, roles: ['role-stewards'] });
    expect(await checkDiscordMembership('token-s', settings, steward)).toMatchObject({ access: { organization: false, raceControl: false, stewards: true } });
    const organizer = discordAnswering(200, { user: { id: 'discord-45', username: 'eva' }, roles: ['role-organization'] });
    expect(await checkDiscordMembership('token-o', settings, organizer)).toMatchObject({ access: { organization: true, raceControl: false, stewards: false } });
  });

  it('distingue ruolo mancante, token non valido e utente fuori dal server', async () => {
    expect(await checkDiscordMembership('token-b', settings, discordAnswering(200, { user: { id: '1', username: 'ale' }, roles: [] }))).toEqual({
      status: 'missing-role',
    });
    expect(await checkDiscordMembership('token-c', settings, discordAnswering(401))).toEqual({ status: 'invalid-token' });
    expect(await checkDiscordMembership('token-d', settings, discordAnswering(404))).toEqual({ status: 'missing-role' });
  });

  it('per qualche minuto non richiede di nuovo a Discord una verifica già riuscita', async () => {
    let discordRequests = 0;
    const countingFetch = () => {
      discordRequests += 1;
      return Promise.resolve(new Response(JSON.stringify({ user: { id: '1', username: 'ale' }, roles: [REQUIRED_ROLE_ID] }), { status: 200 }));
    };

    await checkDiscordMembership('token-e', settings, countingFetch);
    await checkDiscordMembership('token-e', settings, countingFetch);
    expect(discordRequests).toBe(1);
  });
});

describe('GET /crews e /crews/:id', () => {
  let env: Env;
  let handleRequest: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    env = createTestEnv();
    handleRequest = createTestApp(MEMBERSHIPS);
    await handleRequest(postCrew({ name: 'Zeta', number: 90, ...crewDetails(2) }, 'token-director'), env);
    await handleRequest(postCrew({ name: 'Alfa', number: 7, ...crewDetails(1) }, 'token-director'), env);
  });

  it('elenca gli equipaggi per numero crescente', async () => {
    const response = await handleRequest(getPath('/crews', 'token-director'), env);
    expect(response.status).toBe(200);
    const { crews } = (await response.json()) as { crews: { number: number; color: string | null }[] };
    expect(crews.map((crew) => crew.number)).toEqual([7, 90]);
    expect(crews[1]?.color).toBe('#E10600');
  });

  it('restituisce un equipaggio o 404', async () => {
    expect(await (await handleRequest(getPath('/crews/2', 'token-director'), env)).json()).toMatchObject({
      crew: { id: 2, name: 'Alfa', number: 7 },
    });
    expect((await handleRequest(getPath('/crews/99', 'token-director'), env)).status).toBe(404);
  });

  it('anche la lettura richiede login e ruolo', async () => {
    expect((await handleRequest(getPath('/crews'), env)).status).toBe(401);
    expect((await handleRequest(getPath('/crews/1', 'token-no-role'), env)).status).toBe(403);
  });
});

describe('PUT /crews/:id', () => {
  let env: Env;
  let handleRequest: ReturnType<typeof createTestApp>;

  beforeEach(async () => {
    env = createTestEnv();
    handleRequest = createTestApp(MEMBERSHIPS);
    await handleRequest(postCrew({ name: 'Alfa', number: 7, ...crewDetails(1) }, 'token-director'), env);
    await handleRequest(postCrew({ name: 'Beta', number: 8, ...crewDetails(2) }, 'token-director'), env);
  });

  it('aggiorna i dati, anche mantenendo il proprio numero e nome', async () => {
    const response = await handleRequest(
      putCrew(1, { name: 'alfa', number: 7, ...crewDetails(6, 'Cool1 FIE Championship', '#00a3e0') }, 'token-director'),
      env,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      crew: { id: 1, name: 'alfa', number: 7, championships: [{ championship: 'Cool1 FIE Championship', carId: 6 }], color: '#00A3E0' },
    });
  });

  it('rifiuta numero o nome già usati da un altro equipaggio', async () => {
    const sameNumber = await handleRequest(putCrew(1, { name: 'Alfa', number: 8, ...crewDetails(1) }, 'token-director'), env);
    expect(sameNumber.status).toBe(409);
    expect(await readError(sameNumber)).toBe('duplicate-crew-number');

    const sameName = await handleRequest(putCrew(1, { name: ' BETA ', number: 7, ...crewDetails(1) }, 'token-director'), env);
    expect(sameName.status).toBe(409);
    expect(await readError(sameName)).toBe('duplicate-crew-name');
  });

  it('salva il ruolo Discord dell’equipaggio (anche dalla menzione), uno per equipaggio', async () => {
    const role = '1571641908688588963';
    const linked = await handleRequest(putCrew(1, { name: 'Alfa', number: 7, ...crewDetails(1), discordRoleId: `<@&${role}>` }, 'token-director'), env);
    expect(linked.status).toBe(200);
    expect(await linked.json()).toMatchObject({ crew: { id: 1, discordRoleId: role } });
    expect(await (await handleRequest(getPath('/crews/1', 'token-director'), env)).json()).toMatchObject({ crew: { discordRoleId: role } });

    // Lo stesso ruolo non può appartenere a un altro equipaggio.
    const sameRole = await handleRequest(putCrew(2, { name: 'Beta', number: 8, ...crewDetails(2), discordRoleId: role }, 'token-director'), env);
    expect(sameRole.status).toBe(409);
    expect(await readError(sameRole)).toBe('duplicate-crew-role');
    const newWithSameRole = await handleRequest(postCrew({ name: 'Gamma', number: 9, ...crewDetails(2), discordRoleId: role }, 'token-director'), env);
    expect(await readError(newWithSameRole)).toBe('duplicate-crew-role');

    const invalid = await handleRequest(putCrew(2, { name: 'Beta', number: 8, ...crewDetails(2), discordRoleId: '#8 Beta' }, 'token-director'), env);
    expect(invalid.status).toBe(422);

    // Senza ruolo il collegamento si toglie.
    const unlinked = await handleRequest(putCrew(1, { name: 'Alfa', number: 7, ...crewDetails(1), discordRoleId: '' }, 'token-director'), env);
    expect(await unlinked.json()).toMatchObject({ crew: { discordRoleId: null } });
  });

  it('ricontrolla i dati, risponde 404 se l’equipaggio non esiste e richiede il ruolo', async () => {
    expect((await handleRequest(putCrew(1, { name: 'Alfa!', number: 7, ...crewDetails(1) }, 'token-director'), env)).status).toBe(422);
    expect((await handleRequest(putCrew(99, { name: 'Gamma', number: 9, ...crewDetails(1) }, 'token-director'), env)).status).toBe(404);
    expect((await handleRequest(putCrew(1, { name: 'Alfa', number: 7, ...crewDetails(1) }, 'token-no-role'), env)).status).toBe(403);
  });
});

describe('DELETE /crews', () => {
  let env: Env;
  let handleRequest: ReturnType<typeof createTestApp>;

  const deleteCrews = (body: unknown, accessToken?: string) =>
    new Request('https://race-control-api.test/crews', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authorizationHeader(accessToken) },
      body: JSON.stringify(body),
    });

  const remainingNumbers = async () =>
    ((await (await handleRequest(getPath('/crews', 'token-director'), env)).json()) as { crews: { number: number }[] }).crews.map(
      (crew) => crew.number,
    );

  beforeEach(async () => {
    env = createTestEnv();
    handleRequest = createTestApp(MEMBERSHIPS);
    for (const [name, number] of [['Alfa', 1], ['Beta', 2], ['Gamma', 3]] as const) {
      await handleRequest(postCrew({ name, number, ...crewDetails(1) }, 'token-director'), env);
    }
  });

  it('elimina gli equipaggi selezionati e ignora id inesistenti o ripetuti', async () => {
    const response = await handleRequest(deleteCrews({ ids: [1, 3, 3, 99] }, 'token-director'), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedCount: 2 });
    expect(await remainingNumbers()).toEqual([2]);
  });

  it('rifiuta richieste malformate senza eliminare nulla', async () => {
    for (const invalidBody of [{}, { ids: [] }, { ids: ['1'] }, { ids: [1.5] }, { ids: [0] }]) {
      expect((await handleRequest(deleteCrews(invalidBody, 'token-director'), env)).status).toBe(400);
    }
    expect(await remainingNumbers()).toEqual([1, 2, 3]);
  });

  it('richiede login e ruolo', async () => {
    expect((await handleRequest(deleteCrews({ ids: [1] }), env)).status).toBe(401);
    expect((await handleRequest(deleteCrews({ ids: [1] }, 'token-no-role'), env)).status).toBe(403);
    expect(await remainingNumbers()).toEqual([1, 2, 3]);
  });
});
