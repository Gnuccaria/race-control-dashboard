/** Un equipaggio sta in poche decine di byte: richieste più grandi sono sospette. */
const MAX_REQUEST_BODY_BYTES = 2048;
/** Gara con classifica piena e cambi pilota (fino a 5 × 14 righe con le note). */
export const MAX_RACE_BODY_BYTES = 65_536;
/** Campionato con tutte le vetture del catalogo e le impostazioni di sessione di gara e qualifica. */
export const MAX_CHAMPIONSHIP_BODY_BYTES = 32_768;
/** Penalità con motivazione lunga (fino a 2000 caratteri, anche accentati). */
export const MAX_PENALTY_BODY_BYTES = 16_384;

/** Corpo JSON della richiesta; undefined se più grande di maxBytes o non valido. */
export async function readJsonBody(request: Request, maxBytes = MAX_REQUEST_BODY_BYTES): Promise<unknown> {
  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).length > maxBytes) return undefined;
  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return undefined;
  }
}
