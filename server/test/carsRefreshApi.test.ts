import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { bopPageUrl, OFFICIAL_CARLIST_URL } from '../src/cars/carSources';
import type { SourceFetch } from '../src/sources/externalSource';
import type { CarRefreshPreview } from '../../shared/carRules';
import type { Env } from '../src/env';
import { createTestEnv, crewDetails, getPath, MEMBERSHIPS, sendJson } from './support/testApp';

/* ---------- Siti finti, con la stessa struttura di quelli veri ---------- */

const ASSETS = 'https://www.gran-turismo.com/common/dist/gt7/carlist/assets';
const officialCar = (id: string, carClass: string, tuner: string, nameLong: string, nameShort: string, power: number, weight: number, driveTrain: string) =>
  `${id}:{aspirationShort:\`TC\`,carClass:\`${carClass}\`,displacement_v:\`1998\`,driveTrain:\`${driveTrain}\`,id:\`${id}\`,manufacturerId:\`${tuner}\`,nameLong:\`${nameLong}\`,nameShort:\`${nameShort}\`,performancePoint:\`PP 700.00\`,power_v:${power},weight_v:${weight}}`;
const OFFICIAL_CARS_SCRIPT = `var e={${[
  officialCar('car1', 'Gr.3', 'tnr5', "Audi R8 LMS Evo '19", "R8 LMS Evo '19", 585, 1235, 'MR'),
  officialCar('car2', 'Gr.3', 'tnr153', "Mercedes-AMG GT3 '20", "Mercedes-AMG GT3 '20", 550, 1285, 'FR'),
  officialCar('car3', 'Gr.3', 'tnr6', "BMW M3 GT '11", "M3 GT '11", 508, 1245, 'FR'),
  officialCar('car4', 'Gr.1', 'tnr136', "Porsche 919 Hybrid '16", "919 Hybrid '16", 507, 875, 'MR'),
  officialCar('car5', 'Gr.N', 'tnr5', "Audi TT '00", "TT '00", 225, 1400, '4WD'),
].join(',')}};export{e as Cars};`;
const TUNERS_SCRIPT = 'var e={tnr5:{id:`tnr5`,name:`Audi`},tnr6:{id:`tnr6`,name:`BMW`},tnr136:{id:`tnr136`,name:`Porsche`},tnr153:{id:`tnr153`,name:`AMG`}};export{e as Tuners};';
const APP_SCRIPT = '"../generated-assets/data/catalog/cars.it.ts":()=>H(()=>import(`./cars.it-Test1.js`),[]),"../generated-assets/data/catalog/tuners.it.ts":()=>H(()=>import(`./tuners.it-Test2.js`),[])';
const OFFICIAL_PAGE = '<html><head><script type="module" crossorigin src="/common/dist/gt7/carlist/assets/index-Abc123.js"></script></head></html>';

/** Pagina di gt-engine: la tabella Mid-speed, con la potenza divisa in ICE e Hyb. come per le Gr.1. */
function bopPage(rows: readonly (readonly [string, string, number, number])[]) {
  const header =
    '<tr><th rowspan="3"></th><th rowspan="3">Car</th><th rowspan="3">Manufac-<br>turer</th><th rowspan="3">Pt.<br>Lyt.</th><th rowspan="3">PP</th>' +
    '<th rowspan="2" colspan="2">Max. Power<br>[PS]</th><th rowspan="3">Wt.<br>[kg]</th><th colspan="2">Acceleration</th>' +
    '<th rowspan="3">Manufac-<br>turer</th><th rowspan="3">Car</th></tr><tr><th>0-400m</th><th>0-1000m</th></tr>';
  const body = rows
    .map(([manufacturer, car, power, weight], index) => `<tr><td>${index + 1}</td><td>x</td><td>${manufacturer}</td><td>MR</td><td>700.00</td><td>${power}</td><td>?</td><td>${weight.toLocaleString('en-US')}</td><td>12.1</td><td>22.2</td><td>${manufacturer}</td><td>${car}</td></tr>`)
    .join('');
  const average = '<tr><td></td><td>(Avg.)</td><td>-</td><td></td><td>700</td><td>500</td><td>-</td><td>1,000</td><td></td><td></td><td>-</td><td>(Average)</td></tr>';
  return `<p>Ver.1.71</p><p>Ver.1.72</p><table id="spec_table_h"><tr><td>no</td></tr></table><table id="spec_table_m" class="spec_table">${header}${body}${average}</table>`;
}
const BOP_PAGES: Record<string, string> = {
  [bopPageUrl('Gr.1')]: bopPage([['Porsche', "919 Hybrid '16", 507, 975]]),
  [bopPageUrl('Gr.2')]: bopPage([['Audi', "RS 5 Turbo DTM '19", 600, 1000]]),
  [bopPageUrl('Gr.3')]: bopPage([
    ['Audi', "R8 LMS Evo '19", 461, 1240],
    ['AMG', "Mercedes-AMG GT3 '20", 467, 1340],
    ['BMW', "M3 GT3 '11", 455, 1300],
  ]),
  [bopPageUrl('Gr.4')]: bopPage([['Audi', 'TT Cup Gr.4', 400, 1200]]),
};

function fakeSites(overrides: Record<string, string | null> = {}): SourceFetch {
  const pages: Record<string, string> = {
    [OFFICIAL_CARLIST_URL]: OFFICIAL_PAGE,
    [`${ASSETS}/index-Abc123.js`]: APP_SCRIPT,
    [`${ASSETS}/cars.it-Test1.js`]: OFFICIAL_CARS_SCRIPT,
    [`${ASSETS}/tuners.it-Test2.js`]: TUNERS_SCRIPT,
    ...BOP_PAGES,
  };
  return (url) => {
    const page = url in overrides ? overrides[url] : pages[url];
    return Promise.resolve(page === null || page === undefined ? new Response('no', { status: 503 }) : new Response(page));
  };
}

/** Le parti della risposta lette dai test (solo per i tipi). */
interface RefreshBody {
  readonly preview: CarRefreshPreview;
  readonly error?: unknown;
}

describe('POST /cars/refresh', () => {
  let env: Env;
  const call = async (body: unknown, token = 'token-organization', sites = fakeSites()) => {
    const handleRequest = createApp((accessToken) => Promise.resolve(MEMBERSHIPS[accessToken] ?? { status: 'invalid-token' }), undefined, sites);
    const response = await handleRequest(sendJson('POST', '/cars/refresh', body, token), env);
    return { status: response.status, body: (await response.json()) as RefreshBody };
  };
  const listCars = async () => {
    const handleRequest = createApp((accessToken) => Promise.resolve(MEMBERSHIPS[accessToken] ?? { status: 'invalid-token' }));
    return ((await (await handleRequest(getPath('/cars', 'token-organization'), env)).json()) as { cars: Record<string, unknown>[] }).cars;
  };

  beforeEach(() => {
    env = createTestEnv();
  });

  it("anteprima: unisce catalogo ufficiale (Gr.1–Gr.4) e BoP Midspeed, calcola limitatore e zavorra, senza salvare", async () => {
    expect((await call({}, 'token-steward')).status).toBe(403);
    const { status, body } = await call({});
    expect(status).toBe(200);
    const { preview } = body;
    expect(preview.bopVersion).toBe('1.72');
    expect(preview.cars).toEqual([
      expect.objectContaining({ manufacturer: 'Porsche', model: "919 Hybrid '16", group: 'Gr.1', horsepower: 507, weightKg: 875, drivetrain: 'MR', bopHorsepower: 507, bopWeightKg: 975, limiter: 100, ballastKg: 100 }),
      expect.objectContaining({ manufacturer: 'Audi', model: "R8 LMS Evo '19", group: 'Gr.3', bopHorsepower: 461, bopWeightKg: 1240, limiter: 79, ballastKg: 5 }),
      // Il costruttore "AMG" è una parte della prima parola: il costruttore diventa "Mercedes-AMG".
      expect.objectContaining({ manufacturer: 'BMW', model: "M3 GT '11", bopHorsepower: null, limiter: null, ballastKg: null }),
      expect.objectContaining({ manufacturer: 'Mercedes-AMG', model: "GT3 '20", bopHorsepower: 467, bopWeightKg: 1340, limiter: 85, ballastKg: 55 }),
    ]);
    expect(preview.unmatchedOfficial).toEqual([{ officialId: 'car3', group: 'Gr.3', name: "BMW M3 GT '11" }]);
    expect(preview.unmatchedBop.map((car) => car.key)).toEqual(["Gr.2|Audi|RS 5 Turbo DTM '19", "Gr.3|BMW|M3 GT3 '11", 'Gr.4|Audi|TT Cup Gr.4']);
    // Le auto si ritrovano solo dall'id del catalogo ufficiale: quelle della migrazione (senza id, non usate) si eliminano.
    expect(preview.updated).toEqual([]);
    expect(preview.inserted).toEqual(["Porsche 919 Hybrid '16", "Audi R8 LMS Evo '19", "BMW M3 GT '11", "Mercedes-AMG GT3 '20"]);
    expect(preview.deleted).toEqual(['Audi', 'BMW', 'Ferrari', 'Lamborghini', 'Nissan', 'Porsche']);
    // Niente salvato.
    expect((await listCars()).map((car) => car.manufacturer)).toEqual(['Audi', 'BMW', 'Ferrari', 'Lamborghini', 'Nissan', 'Porsche']);
  });

  it('salva le vetture dei siti; le auto usate che non vi sono restano', async () => {
    const handleRequest = createApp((accessToken) => Promise.resolve(MEMBERSHIPS[accessToken] ?? { status: 'invalid-token' }));
    // Un equipaggio usa la Ferrari (id 3), che nei siti non c'è: resta.
    await handleRequest(sendJson('POST', '/crews', { name: 'Alfa', number: 1, ...crewDetails(3) }, 'token-organization'), env);
    const { status, body } = await call({ apply: true });
    expect(status).toBe(200);
    expect(body.preview.kept).toEqual(['Ferrari']);
    const cars = await listCars();
    expect(cars.find((car) => car.model === "R8 LMS Evo '19")).toMatchObject({ manufacturer: 'Audi', group: 'Gr.3', limiter: 79, ballastKg: 5 });
    expect(cars.find((car) => car.id === 3)).toMatchObject({ manufacturer: 'Ferrari', model: null });
    expect(cars.map((car) => car.manufacturer).sort()).toEqual(['Audi', 'BMW', 'Ferrari', 'Mercedes-AMG', 'Porsche']);
    // Le vetture salvate tengono il loro id negli aggiornamenti successivi (un equipaggio può usarle).
    const audiId = cars.find((car) => car.model === "R8 LMS Evo '19")?.id;
    await call({ apply: true });
    expect((await listCars()).find((car) => car.model === "R8 LMS Evo '19")?.id).toBe(audiId);
    // Un secondo aggiornamento ritrova tutte le auto dall'id del catalogo: nessun cambiamento.
    const again = await call({});
    expect(again.body.preview).toMatchObject({ inserted: [], updated: [], deleted: [], kept: ['Ferrari'] });
  });

  it("un abbinamento scelto a mano dà il BoP all'auto e resta per gli aggiornamenti successivi", async () => {
    const match = { officialId: 'car3', bopKey: "Gr.3|BMW|M3 GT3 '11" };
    const preview = (await call({ matches: [match] })).body.preview;
    expect(preview.cars.find((car) => car.model === "M3 GT '11")).toMatchObject({ bopHorsepower: 455, bopWeightKg: 1300, limiter: 90, ballastKg: 55 });
    expect(preview.unmatchedOfficial).toEqual([]);
    await call({ matches: [match], apply: true });
    const later = (await call({})).body.preview;
    expect(later.cars.find((car) => car.model === "M3 GT '11")).toMatchObject({ bopHorsepower: 455 });
    // "Nessuna" (null) toglie anche un abbinamento automatico.
    const none = (await call({ matches: [{ officialId: 'car1', bopKey: null }] })).body.preview;
    expect(none.cars.find((car) => car.model === "R8 LMS Evo '19")).toMatchObject({ bopHorsepower: null, limiter: null });
    expect((await call({ matches: [{ officialId: 'nope', bopKey: null }] })).status).toBe(400);
  });

  it("un'auto usata che resta ma ha il nome di una vettura dei siti diventa \"(vecchia)\" e il salvataggio riesce", async () => {
    // L'auto 2 ha già l'id del catalogo ufficiale di car1, con un altro nome; l'auto 1, usata, ha già il nome di car1.
    await env.CREWS_DB.prepare("UPDATE cars SET model = 'R8 LMS Evo ''19' WHERE id = 1").run();
    await env.CREWS_DB.prepare("UPDATE cars SET manufacturer = 'Audi', model = 'R8 vecchio nome', source_id = 'car1' WHERE id = 2").run();
    const handleRequest = createApp((accessToken) => Promise.resolve(MEMBERSHIPS[accessToken] ?? { status: 'invalid-token' }));
    await handleRequest(sendJson('POST', '/crews', { name: 'Alfa', number: 1, ...crewDetails(1) }, 'token-organization'), env);

    const { status, body } = await call({ apply: true });
    expect(status).toBe(200);
    expect(body.preview.kept).toEqual(["Audi R8 LMS Evo '19 → Audi R8 LMS Evo '19 (vecchia)"]);
    const cars = await listCars();
    expect(cars.find((car) => car.id === 1)).toMatchObject({ manufacturer: 'Audi', model: "R8 LMS Evo '19 (vecchia)" });
    expect(cars.find((car) => car.id === 2)).toMatchObject({ manufacturer: 'Audi', model: "R8 LMS Evo '19", limiter: 79 });
  });

  it('ricalcolo e salvataggio con refetch: false riusano i dati scaricati, senza riscaricare i siti', async () => {
    const requested: string[] = [];
    const sites = fakeSites();
    const countingSites: SourceFetch = (url, init) => {
      requested.push(url);
      return sites(url, init);
    };
    await call({}, 'token-organization', countingSites);
    expect(requested).toHaveLength(8);
    const match = { officialId: 'car3', bopKey: "Gr.3|BMW|M3 GT3 '11" };
    // Ora i siti non risponderebbero più: non servono.
    const offline = fakeSites(Object.fromEntries(requested.map((url) => [url, null])));
    const saved = await call({ matches: [match], apply: true, refetch: false }, 'token-organization', offline);
    expect(saved.status).toBe(200);
    expect(saved.body.preview.cars.find((car) => car.model === "M3 GT '11")).toMatchObject({ bopHorsepower: 455 });
    // Senza dati salvati (o con refetch) si scarica di nuovo.
    expect((await call({ refetch: true }, 'token-organization', offline)).status).toBe(502);
    expect((await call({ refetch: 'sì' })).status).toBe(400);
  });

  it('se un sito non risponde o è cambiato non salva nulla e lo dice', async () => {
    const unreachable = await call({ apply: true }, 'token-organization', fakeSites({ [bopPageUrl('Gr.2')]: null }));
    expect(unreachable).toEqual({ status: 502, body: { error: { code: 'car-source-unreachable', details: { source: 'bop' } } } });
    const changed = await call({ apply: true }, 'token-organization', fakeSites({ [OFFICIAL_CARLIST_URL]: '<html>nuovo sito</html>' }));
    expect(changed).toEqual({ status: 502, body: { error: { code: 'car-source-changed', details: { source: 'official' } } } });
    expect(await listCars()).toHaveLength(6);
  });
});
