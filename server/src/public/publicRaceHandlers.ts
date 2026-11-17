import { hasRaceStarted } from '../../../shared/raceSchedule';
import type { Env } from '../env';
import { errorResponse, publicJsonResponse, publicPdfResponse } from '../http/jsonResponse';
import { findRaceSummaryById, listPublicRaceResults, listRaces } from '../races/raceRepository';
import { buildRaceReport, reportFileName } from '../reports/raceReportData';
import { renderRaceReportPdf } from '../reports/raceReportPdf';
import { loadRaceReportInput } from '../reports/raceReportRepository';
import { readReportLanguage } from '../reports/reportTexts';

/** "Round 3 – Cool1 FIE Championship", come nell'app quando la gara non ha un nome. */
const roundTitle = (round: number, championship: string) => `Round ${round} – ${championship}`;

/**
 * Lettura pubblica delle gare per il sito dei risultati: nessun accesso Discord, solo GET,
 * e solo i dati da mostrare (nessun id Discord di chi ha inserito la gara).
 */
export const publicRaceHandlers = {
  // Le gare inserite in anticipo non si mostrano finché non cominciano.
  async listRaces(_request: Request, env: Env): Promise<Response> {
    return publicJsonResponse({ races: (await listRaces(env.CREWS_DB)).filter((race) => hasRaceStarted(race)) });
  },

  async getRace(_request: Request, env: Env, raceId: number): Promise<Response> {
    const race = await findRaceSummaryById(env.CREWS_DB, raceId);
    if (!race || !hasRaceStarted(race)) return errorResponse(404, 'not-found');
    return publicJsonResponse({ race: { ...race, results: await listPublicRaceResults(env.CREWS_DB, raceId) } });
  },

  /**
   * GET /public/races/:id/report.pdf — referto di gara generato al momento dai dati salvati.
   * Inline (si apre nella pagina); il nome del file serve a "Scarica referto".
   * ?lang=it|en|fr|de sceglie la lingua dei testi fissi (italiano se manca); in inglese anche violazioni e motivazioni.
   */
  async getRaceReport(request: Request, env: Env, raceId: number): Promise<Response> {
    const race = await findRaceSummaryById(env.CREWS_DB, raceId);
    const input = race && hasRaceStarted(race) ? await loadRaceReportInput(env.CREWS_DB, raceId, roundTitle) : null;
    if (!input) return errorResponse(404, 'not-found');
    const language = readReportLanguage(new URL(request.url).searchParams.get('lang'));
    const pdfBytes = await renderRaceReportPdf(buildRaceReport({ ...input, language }));
    return publicPdfResponse(pdfBytes, reportFileName(input.title, language));
  },
};
