import { ENGLISH_REASON_MAX_LENGTH, type EnglishPenaltyText } from '../../../shared/penaltyRules';

/**
 * Traduzione in inglese della motivazione di una penalità, da qualunque lingua sia scritta. La violazione non si
 * traduce: è il numero dell'articolo più il documento, e il referto la scrive con una frase fissa per lingua.
 *
 * 1. Prima si sostituiscono con segnaposto ([[1]], [[2]]…) le parti da non toccare: numeri delle vetture, numeri
 *    degli articoli, tempi e sigle dei regolamenti. La motivazione va poi a un modello di Workers AI con un
 *    glossario della Direzione Gara.
 * 2. Dopo si controlla che ogni segnaposto sia tornato una e una sola volta e si rimettono i testi: quelli
 *    originali, tranne le sigle dei regolamenti, che diventano quelle inglesi (C.d.C. → C. C., Reg. Tec. → Tech. Reg.).
 *    Se manca qualcosa la traduzione si scarta.
 * 3. Se qualcosa non va (nessun binding AI, quota finita, risposta non valida) il risultato è null: la penalità
 *    si salva comunque e il referto in inglese usa la motivazione originale.
 */

/** Modello linguistico di Workers AI: segue le istruzioni (glossario, segnaposto) e risponde in JSON validato. */
export const TRANSLATION_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** La parte del binding AI di Workers che serve qui (nei test si sostituisce con un finto). */
export interface TranslationModel {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

/* ---------- 1. Parti protette ---------- */

/** In ordine: prima i tempi (1:34.065), poi vetture, articoli e sigle dei regolamenti. */
const PROTECTED_PATTERNS: readonly RegExp[] = [
  /\b\d{1,2}:\d{2}(?:[.,]\d{1,3})?\b/g,
  /#\d{1,3}\b/g,
  /\b\d+(?:\.\d+)+\b/g,
  /C\.d\.C\./g,
  /Reg\.\s?Tec\./g,
];

/** Sigle dei regolamenti nella versione inglese (Technical Regulations, Code of Conduct). */
const ENGLISH_ABBREVIATIONS: readonly (readonly [RegExp, string])[] = [
  [/^C\.d\.C\.$/, 'C. C.'],
  [/^Reg\.\s?Tec\.$/, 'Tech. Reg.'],
];

/** Termine protetto come va scritto nel testo inglese. */
export const englishProtectedTerm = (term: string): string =>
  ENGLISH_ABBREVIATIONS.find(([pattern]) => pattern.test(term))?.[1] ?? term;

const PLACEHOLDER_PATTERN = /\[\[(\d+)\]\]/g;

export interface ProtectedText {
  readonly text: string;
  /** Testo originale di ogni segnaposto, in ordine: [[1]] è protectedTerms[0]. */
  readonly protectedTerms: readonly string[];
}

/** Sostituisce le parti da non tradurre con [[1]], [[2]]…; i segnaposto continuano la numerazione di firstIndex. */
export function protectTerms(text: string, firstIndex = 1): ProtectedText {
  const protectedTerms: string[] = [];
  let maskedText = text;
  for (const pattern of PROTECTED_PATTERNS) {
    maskedText = maskedText.replace(pattern, (term) => {
      protectedTerms.push(term);
      return `[[${firstIndex + protectedTerms.length - 1}]]`;
    });
  }
  return { text: maskedText, protectedTerms };
}

/**
 * Rimette i testi originali al posto dei segnaposto. null se un segnaposto atteso manca, compare due volte
 * o non esiste: vuol dire che il modello ha toccato una parte protetta.
 */
export function restoreTerms(translatedText: string, termByIndex: ReadonlyMap<number, string>): string | null {
  const seen = new Set<number>();
  for (const match of translatedText.matchAll(PLACEHOLDER_PATTERN)) {
    const index = Number(match[1]);
    if (!termByIndex.has(index) || seen.has(index)) return null;
    seen.add(index);
  }
  if (seen.size !== termByIndex.size) return null;
  return translatedText.replace(PLACEHOLDER_PATTERN, (_placeholder, index: string) => termByIndex.get(Number(index)) ?? '');
}

/* ---------- 2. Modello ---------- */

/** Termini della Direzione Gara con una traduzione fissa. */
export const STEWARDING_GLOSSARY: readonly (readonly [string, string])[] = [
  ['vettura / vetture', 'car / cars'],
  ['Codice di Condotta', 'Code of Conduct'],
  ['Regolamento Tecnico', 'Technical Regulations'],
  ['Curva 13', 'Turn 13'],
  ['reprimenda', 'reprimand'],
  ['Direzione Gara', 'Race Control'],
  ['Nessuna azione ulteriore', 'No further action'],
  ['scia', 'slipstream'],
  ['frenata, fase di frenata', 'braking, braking phase'],
  ['staccata', 'braking zone'],
  ['traiettoria (ideale)', '(racing) line'],
  ['affiancarsi', 'to draw alongside'],
  ['sorpasso, sorpassare', 'overtake'],
  ['uscire di pista, fuori pista', 'to leave the track, off track'],
  ['rientrare in pista, rientro non sicuro', 'to rejoin the track, unsafe rejoin'],
  ['non ha il diritto allo spazio', 'is not entitled to racing room'],
  ['colpevolezza', 'fault'],
  ['sottosterzare', 'to understeer'],
  ['muretto', 'wall'],
  ['manto erboso', 'grass'],
  ['bandiera verde', 'green flag'],
  ['griglia di partenza', 'starting grid'],
  ['errore di rete della lobby', 'lobby network error'],
  ['track limits', 'track limits'],
];

const SYSTEM_PROMPT = [
  'You translate the reasons of stewarding decisions of a sim racing league into clear, formal English.',
  'The input may be in any language; if a text is already in English, return it unchanged.',
  'Rules:',
  '- Translate faithfully: do not add, remove, explain or summarise anything.',
  '- Copy each placeholder such as [[1]] exactly once, unchanged, in the right place of the sentence.',
  '- Keep line breaks and keep the case of the first letter: a reason starting in lowercase continues the',
  '  sentence of the violation in the report, so its English translation starts in lowercase too.',
  '- Every placeholder stands for a car number, an article number, a time or a regulation abbreviation.',
  '- Use this glossary (source term → English term):',
  ...STEWARDING_GLOSSARY.map(([source, english]) => `  ${source} → ${english}`),
  'Answer with JSON: {"reason": "..."}.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: { reason: { type: 'string' } },
  required: ['reason'],
};

/** Risposta del modello → oggetto; Workers AI la restituisce già come oggetto o come testo JSON. */
function readModelAnswer(output: unknown): string | null {
  const response = (output as { response?: unknown } | null)?.response;
  let answer: unknown = response;
  if (typeof response === 'string') {
    try {
      answer = JSON.parse(response);
    } catch {
      return null;
    }
  }
  const { reason } = (answer ?? {}) as Record<string, unknown>;
  return typeof reason === 'string' ? reason : null;
}

/** Motivazione inglese della penalità ('' se non c'è motivazione); null se non è stato possibile tradurla in modo affidabile. */
export async function translatePenaltyToEnglish(model: TranslationModel | undefined, reason: string): Promise<EnglishPenaltyText | null> {
  if (reason.trim() === '') return { reason: '' };
  if (!model) return null;

  const masked = protectTerms(reason);
  const termByIndex = new Map(masked.protectedTerms.map((term, index) => [index + 1, englishProtectedTerm(term)] as const));
  try {
    const output = await model.run(TRANSLATION_MODEL, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ reason: masked.text }) },
      ],
      response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
      temperature: 0,
      max_tokens: 2048,
    });
    const answer = readModelAnswer(output);
    if (answer === null) return null;
    const englishReason = restoreTerms(answer.trim(), termByIndex);
    if (englishReason === null || englishReason === '' || englishReason.length > ENGLISH_REASON_MAX_LENGTH) return null;
    return { reason: englishReason };
  } catch (translationError) {
    console.error('Traduzione della penalità non riuscita', translationError);
    return null;
  }
}
