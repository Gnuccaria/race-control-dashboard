import { PDFDocument } from 'pdf-lib';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../src/env';
import { buildRaceReport, describeDecision, describeDecisions, formatReportTime, joinCarNumbers, reportFileName } from '../src/reports/raceReportData';
import { readReportLanguage, reportTexts } from '../src/reports/reportTexts';
import { createTestApp, createTestEnv, getPath, REQUIRED_DETAILS, sendJson } from './support/testApp';

describe('dati del referto', () => {
  it('scrive tempi, vetture e decisioni come nel referto originale', () => {
    expect(formatReportTime(58_196)).toBe('58.196');
    expect(formatReportTime(94_065)).toBe('1:34.065');
    expect(formatReportTime(5_650_345)).toBe('1:34:10.345');
    expect(joinCarNumbers([120, 21])).toBe('#21 e #120');
    expect(joinCarNumbers([61, 120, 690])).toBe('#61, #120 e #690');
    expect(describeDecision('time-10', [46], 6)).toBe('+10 secondi al tempo di gara della vettura #46');
    expect(describeDecision('time-30', [21, 120], 6)).toBe('+30 secondi al tempo di gara delle vetture #21 e #120');
    expect(describeDecision('reprimand', [16], 6)).toBe('Reprimenda per la vettura #16');
    expect(describeDecision('grid-2', [54], 6)).toBe('+2 posizioni in griglia di partenza nel Round 7 per la vettura #54');
    expect(describeDecision('grid-1', [54, 7], 6)).toBe('+1 posizione in griglia di partenza nel Round 7 per le vetture #7 e #54');
    expect(describeDecision('race-disqualification', [7], 6)).toBe('Squalifica dalla gara della vettura #7');
    // Una riga per decisione; nessuna decisione = "Nessuna azione ulteriore".
    expect(
      describeDecisions(
        [
          { number: 46, decision: 'time-10' },
          { number: 21, decision: 'reprimand' },
          { number: 26, decision: null },
          { number: 20, decision: 'time-10' },
        ],
        6,
      ),
    ).toBe('Reprimenda per la vettura #21\n+10 secondi al tempo di gara delle vetture #20 e #46');
    expect(describeDecisions([{ number: 51, decision: null }, { number: 67, decision: null }], 6)).toBe('Nessuna azione ulteriore');
    // Reprimende numerate nel ciclo della vettura; alla terza, +1 posizione in griglia in automatico.
    expect(
      describeDecisions(
        [
          { number: 53, decision: 'reprimand', reprimandNumber: 3 },
          { number: 16, decision: 'reprimand', reprimandNumber: 1 },
        ],
        6,
      ),
    ).toBe('Reprimenda per le vetture #16 (1) e #53 (3)\n+1 posizione in griglia di partenza nel Round 7 per la vettura #53 (terza reprimenda)');
    expect(reportFileName('Round 1 – A/B: "C"')).toBe('Referto di gara - Round 1 – A B C.pdf');
  });

  it('distacco in tempo o in giri e penalità sommate (decisioni a tempo + cambi pilota non annullati)', () => {
    const row = (position: number, crewId: number, laps: number, gapMs: number | null) => ({
      position,
      crewId,
      crewNumber: crewId * 10,
      crewName: `Team ${crewId}`,
      carManufacturer: crewId === 3 ? null : 'Nissan',
      laps,
      gapMs,
    });
    const report = buildRaceReport({
      title: '1000 km di Suzuka',
      round: 6,
      results: [row(1, 1, 139, null), row(2, 2, 139, 58_196), row(3, 3, 137, null)],
      penalties: [
        { crews: [{ crewId: 2, decision: 'time-30', reprimandNumber: null }, { crewId: 3, decision: 'time-30', reprimandNumber: null }], violation: '2.4', document: 'code-of-conduct' as const, reason: '' },
        { crews: [{ crewId: 1, decision: null, reprimandNumber: null }, { crewId: 2, decision: 'time-5', reprimandNumber: null }], violation: '2.4', document: 'code-of-conduct' as const, reason: '' },
        { crews: [{ crewId: 1, decision: 'grid-2', reprimandNumber: null }, { crewId: 3, decision: null, reprimandNumber: null }], violation: '2.4', document: 'code-of-conduct' as const, reason: 'Motivo' },
        { crews: [{ crewId: 1, decision: null, reprimandNumber: null }, { crewId: 3, decision: null, reprimandNumber: null }], violation: '2.4', document: 'code-of-conduct' as const, reason: '' },
      ],
      driverSwaps: [
        { crewId: 3, penaltyMs: 7_500, isCancelled: false },
        { crewId: 1, penaltyMs: 9_000, isCancelled: true },
      ],
      crewNumberById: new Map([
        [1, 10],
        [2, 20],
        [3, 30],
      ]),
    });
    expect(report.classification).toEqual([
      { position: '1', number: '10', crew: 'Team 1', car: 'Nissan', laps: '139', leader: '-', penalty: '' },
      { position: '2', number: '20', crew: 'Team 2', car: 'Nissan', laps: '139', leader: '+58.196', penalty: '+35.000' },
      { position: '3', number: '30', crew: 'Team 3', car: '-', laps: '137', leader: '+2 giri', penalty: '+37.500' },
    ]);
    expect(report.penalties.map((penalty) => [penalty.crews, penalty.decision])).toEqual([
      ['#20, #30', '+30 secondi al tempo di gara delle vetture #20 e #30'],
      ['#10, #20', '+5 secondi al tempo di gara della vettura #20'],
      ['#10, #30', '+2 posizioni in griglia di partenza nel Round 7 per la vettura #10'],
      ['#10, #30', 'Nessuna azione ulteriore'],
    ]);
  });

  it('scrive le decisioni nella lingua del sito', () => {
    const en = reportTexts('en');
    expect(describeDecision('time-10', [120, 21], 6, en)).toBe('+10 seconds added to the race time of cars #21 and #120');
    expect(describeDecision('grid-2', [54], 6, en)).toBe('+2 starting grid positions in Round 7 for car #54');
    expect(describeDecisions([{ number: 53, decision: 'reprimand', reprimandNumber: 3 }], 6, en)).toBe(
      'Reprimand for car #53 (3)\n+1 starting grid position in Round 7 for car #53 (third reprimand)',
    );
    expect(describeDecisions([{ number: 1, decision: null }], 6, en)).toBe('No further action');
    expect(describeDecision('race-disqualification', [7], 1, en)).toBe('Disqualification from the race of car #7');
    // Solo italiano e inglese: ogni altra lingua del sito riceve il referto in inglese.
    expect(readReportLanguage('it')).toBe('it');
    expect(readReportLanguage('EN')).toBe('en');
    expect(readReportLanguage('fr')).toBe('en');
    expect(readReportLanguage('de')).toBe('en');
    expect(readReportLanguage('es')).toBe('en');
    expect(readReportLanguage(null)).toBe('it');
    expect(reportFileName('1000 km di Suzuka', 'en')).toBe('Race report - 1000 km di Suzuka.pdf');
  });

  it('nel referto in inglese usa la traduzione salvata; nelle altre lingue il testo originale', () => {
    const input = {
      title: 'Gara',
      round: 1,
      results: [{ position: 1, crewId: 1, crewNumber: 16, crewName: 'Alfa', carManufacturer: null, laps: 20, gapMs: null },
        { position: 2, crewId: 2, crewNumber: 44, crewName: 'Beta', carManufacturer: null, laps: 19, gapMs: null }],
      penalties: [
        { crews: [{ crewId: 1, decision: null, reprimandNumber: null }], violation: '2.4', document: 'code-of-conduct' as const, reason: 'Spinta', english: { reason: 'Push' } },
        { crews: [{ crewId: 2, decision: null, reprimandNumber: null }], violation: '3.1', document: 'technical-regulations' as const, reason: 'Partenza', english: null },
        // Penalità salvata prima del numero di articolo: il testo resta com'è.
        { crews: [{ crewId: 2, decision: null, reprimandNumber: null }], violation: 'Contatto libero', document: 'code-of-conduct' as const, reason: '', english: null },
      ],
      driverSwaps: [],
      crewNumberById: new Map([[1, 16], [2, 44]]),
    };
    const english = buildRaceReport({ ...input, language: 'en' });
    expect(english.penalties.map(({ violation, reason }) => [violation, reason])).toEqual([
      ['Breach of Art. 2.4 of the C. C.', 'Push'],
      ['Breach of Art. 3.1 of the Tech. Reg.', 'Partenza'],
      ['Contatto libero', ''],
    ]);
    const italian = buildRaceReport({ ...input, language: 'it' });
    expect(italian.penalties.map(({ violation }) => violation)).toEqual(['Violazione dell’art. 2.4 del C.d.C.', 'Violazione dell’art. 3.1 del Reg. Tec.', 'Contatto libero']);
    expect(english.classification[1]?.leader).toBe('+1 lap');
    expect(italian.penalties[0]).toMatchObject({ reason: 'Spinta', decision: 'Nessuna azione ulteriore' });
    expect(italian.classification[1]?.leader).toBe('+1 giro');
  });
});

describe('GET /public/races/:id/report.pdf', () => {
  let env: Env;
  let handleRequest: ReturnType<typeof createTestApp>;
  const request = (method: 'POST' | 'PUT', path: string, body: unknown) => handleRequest(sendJson(method, path, body, 'token-director'), env);

  beforeEach(async () => {
    env = createTestEnv();
    handleRequest = createTestApp();
    await request('POST', '/crews', { name: 'Alfa', number: 16, carId: 1, ...REQUIRED_DETAILS });
    await request('POST', '/crews', { name: 'Beta Café', number: 44, carId: 2, ...REQUIRED_DETAILS });
    await request('POST', '/races', {
      name: '1000 km di Suzuka',
      championship: REQUIRED_DETAILS.championship,
      duration: '6 hours',
      round: 1,
      trackId: null,
      raceDate: '2026-11-08',
      results: [
        { position: 1, crewId: 1, laps: 139 },
        { position: 2, crewId: 2, laps: 139, gapMs: 58_196 },
      ],
    });
    await request('POST', '/races/1/penalties', {
      crews: [{ crewId: 1, decision: null }, { crewId: 2, decision: 'time-10' }],
      violation: '2.3.1',
      document: 'code-of-conduct',
      reason: 'Contatto → curva 1',
    });
  });

  it('restituisce il referto in PDF, senza accesso e con il nome del file', async () => {
    const response = await handleRequest(getPath('/public/races/1/report.pdf'), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toContain('filename="Referto di gara - 1000 km di Suzuka.pdf"');
    expect(response.headers.get('Cache-Control')).toContain('public');
    const document = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()));
    // Copertina + una pagina con classifica e penalità.
    expect(document.getPageCount()).toBe(2);
    expect(document.getTitle()).toBe('Referto di gara – 1000 km di Suzuka');
  });

  it('sceglie la lingua con ?lang=', async () => {
    const response = await handleRequest(getPath('/public/races/1/report.pdf?lang=en'), env);
    expect(response.headers.get('Content-Disposition')).toContain('filename="Race report - 1000 km di Suzuka.pdf"');
    const document = await PDFDocument.load(new Uint8Array(await response.arrayBuffer()));
    expect(document.getTitle()).toBe('Race report – 1000 km di Suzuka');
    // Lingue del sito diverse dall'italiano → referto in inglese; senza lingua → italiano.
    const german = await handleRequest(getPath('/public/races/1/report.pdf?lang=de'), env);
    expect(german.headers.get('Content-Disposition')).toContain('Race report');
    const italian = await handleRequest(getPath('/public/races/1/report.pdf?lang=it'), env);
    expect(italian.headers.get('Content-Disposition')).toContain('Referto di gara');
  });

  it('404 per una gara inesistente', async () => {
    expect((await handleRequest(getPath('/public/races/9/report.pdf'), env)).status).toBe(404);
  });
});
