import type { Env } from '../env';
import { errorResponse, publicJsonResponse, publicPdfResponse } from '../http/jsonResponse';
import { findRaceSummaryById, listPublicRaceResults, listRaces } from '../races/raceRepository';
import { buildRaceReport, reportFileName, totalPenaltyByCrew } from '../reports/raceReportData';
import { renderRaceReportPdf } from '../reports/raceReportPdf';
import { findRaceWeather } from '../weather/weatherRepository';
import { loadRaceReportInput } from '../reports/raceReportRepository';
import { readReportLanguage } from '../reports/reportTexts';

/** "Round 3 – Cool1 FIE Championship", come nell'app quando la gara non ha un nome. */
const roundTitle = (round: number, championship: string) => `Round ${round} – ${championship}`;

/**
 * Lettura pubblica delle gare per il sito dei risultati: nessun accesso Discord, solo GET,
 * e solo i dati da mostrare (nessun id Discord di chi ha inserito la gara).
 */
export const publicRaceHandlers = {
  // Anche le gare inserite in anticipo: il sito ne mostra meteo e documentazione prima che comincino.
  async listRaces(_request: Request, env: Env): Promise<Response> {
    return publicJsonResponse({ races: await listRaces(env.CREWS_DB) });
  },

  async getRace(_request: Request, env: Env, raceId: number): Promise<Response> {
    const race = await findRaceSummaryById(env.CREWS_DB, raceId);
    if (!race) return errorResponse(404, 'not-found');
    // Penalità di ogni posizione come nel referto: decisioni a tempo + cambi pilota (secondi per eccesso).
    const [results, reportInput] = await Promise.all([listPublicRaceResults(env.CREWS_DB, raceId), loadRaceReportInput(env.CREWS_DB, raceId, roundTitle)]);
    const totals = reportInput ? totalPenaltyByCrew(reportInput.penalties, reportInput.driverSwaps) : new Map<number, number>();
    const crewIdByPosition = new Map((reportInput?.results ?? []).map((row) => [row.position, row.crewId]));
    const withPenalties = results.map((result) => {
      const total = totals.get(crewIdByPosition.get(result.position) ?? -1) ?? 0;
      return { ...result, penaltyMs: total > 0 ? total : null };
    });
    return publicJsonResponse({ race: { ...race, results: withPenalties, weather: await findRaceWeather(env.CREWS_DB, race) } });
  },

  /**
   * GET /public/races/:id/report.pdf — referto di gara generato al momento dai dati salvati.
   * Inline (si apre nella pagina); il nome del file serve a "Scarica referto".
   * ?lang=it|en|fr|de sceglie la lingua dei testi fissi (italiano se manca); in inglese anche violazioni e motivazioni.
   */
  async getRaceReport(request: Request, env: Env, raceId: number): Promise<Response> {
    const race = await findRaceSummaryById(env.CREWS_DB, raceId);
    const input = race ? await loadRaceReportInput(env.CREWS_DB, raceId, roundTitle) : null;
    if (!input) return errorResponse(404, 'not-found');
    const language = readReportLanguage(new URL(request.url).searchParams.get('lang'));
    const pdfBytes = await renderRaceReportPdf(buildRaceReport({ ...input, language }));
    return publicPdfResponse(pdfBytes, reportFileName(input.title, language));
  },
};
