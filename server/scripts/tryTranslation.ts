/**
 * Prova la traduzione inglese delle motivazioni delle penalità con il vero modello di Workers AI, su quelle del
 * referto della 1000 km di Suzuka (o su un testo a scelta), senza toccare il database.
 *
 *   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… npm run translation:try
 *   CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… npm run translation:try -- "Motivazione"
 *
 * Il token serve solo a questo script: crealo nella dashboard di Cloudflare (My Profile → API Tokens) con il
 * permesso "Workers AI: Read". Il server online non ne ha bisogno: usa il binding AI di wrangler.jsonc.
 * Per ogni motivazione mostra l'originale, la traduzione e se i termini protetti (vetture, articoli; le sigle
 * C.d.C. e Reg. Tec. diventano C. C. e Tech. Reg.) sono al loro posto; "SCARTATA" vuol dire che il server non la salverebbe.
 */
import { type TranslationModel, translatePenaltyToEnglish } from '../src/translation/penaltyTranslation';

const SUZUKA_REASONS = [
  'la vettura #54 frena tardivamente a Curva 13, colpendo la vettura #53. Durante ogni momento della frenata la vettura #53 è sempre chiaramente avanti e la vettura #54 non ha il diritto allo spazio. Nessuna vettura riporta danni significativi ma la vettura #53 perde la posizione, mentre la vettura #54 guadagna un vantaggio.',
  'la vettura #51 e la vettura #67 si affiancano leggermente in fase di frenata prima di Curva 1. La vettura #51, prima dell’ingresso della curva, si affianca alla vettura #67 lasciandole l’esterno. La vettura #67 imposta la curva indipendentemente dalla presenza della vettura #51, urtandola. Non è pertanto possibile stabilire una chiara colpevolezza di una delle due auto.',
  'la vettura #67 segue la vettura #21 molto ravvicinatamente. All’ingresso di Curva 11 la vettura #67 si allarga per prendere l’interno della curva, mentre la vettura #21 cambia traiettoria mentre inizia la fase di frenata, impedendo quindi la vettura #67. Nessuna delle due auto riporta danni.',
  'la vettura #53 sfrutta la scia e si affianca alla vettura #26 fino a sorpassarla quasi completamente. Nei pressi di Curva 15 la vettura #53 stringe la traiettoria, urtando la vettura #26 e uscendo di pista.',
  'la vettura #21 esce di pista dopo Curva 15 e tenta di rientrare appaiata alla vettura #61, che la precedeva in tutto il tratto. La vettura #21 guadagna velocità fuori dalla pista, ma nella transizione tra il manto erboso e la pista perde il controllo della vettura, urtando il muretto. Si conclude quindi che la vettura #21 è rientrata in pista in modo non sicuro.',
  'le vetture #21 e #120 non partono dalle file designate al momento della bandiera verde.',
  'a causa di errore di rete della lobby non è possibile stabilire chiaramente una parte colpevole.',
  'Le vetture #8 e #46 si toccano alla fine della corsia box; nessun danno.',
  'la vettura #46 rientra in pista in modo non sicuro, come previsto dall’art. 2.4 del C.d.C. e dall’art. 3.1 del Reg. Tec.',
] as const;

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
if (!accountId || !apiToken) {
  console.error('Imposta CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN (permesso "Workers AI: Read").');
  process.exit(1);
}

/** Lo stesso contratto del binding AI di Workers, sopra le API REST di Cloudflare. */
const restModel: TranslationModel = {
  async run(model, inputs) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    });
    const body = (await response.json()) as { success: boolean; result?: unknown; errors?: unknown };
    if (!response.ok || !body.success) throw new Error(`Workers AI ha risposto ${response.status}: ${JSON.stringify(body.errors)}`);
    return body.result;
  },
};

/** Termini protetti nell'ordine in cui compaiono, con le sigle dei regolamenti già nella versione inglese. */
const protectedTerms = (text: string) =>
  (text.match(/#\d+|\b\d+(?:\.\d+)+\b|C\.d\.C\.|C\. C\.|Reg\. ?Tec\.|Tech\. Reg\./g) ?? [])
    .map((term) => (term === 'C.d.C.' ? 'C. C.' : /^Reg\./.test(term) ? 'Tech. Reg.' : term))
    .sort()
    .join(' ');
const [customReason] = process.argv.slice(2);
const reasons = customReason ? [customReason] : SUZUKA_REASONS;

let discarded = 0;
for (const reason of reasons) {
  const english = await translatePenaltyToEnglish(restModel, reason);
  console.log(`\n— ${reason}`);
  if (!english) {
    discarded += 1;
    console.log('  → SCARTATA (il referto in inglese userebbe la motivazione originale)');
    continue;
  }
  const isSame = protectedTerms(reason) === protectedTerms(english.reason);
  console.log(`  → ${english.reason}\n    termini protetti: ${isSame ? 'al loro posto' : 'DIVERSI'}`);
}
console.log(`\n${reasons.length - discarded} di ${reasons.length} tradotte.`);
