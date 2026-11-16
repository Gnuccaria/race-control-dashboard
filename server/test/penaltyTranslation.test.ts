import { describe, expect, it } from 'vitest';
import { englishProtectedTerm, protectTerms, restoreTerms, type TranslationModel, translatePenaltyToEnglish } from '../src/translation/penaltyTranslation';

/** Modello finto: risponde con la motivazione ricevuta passata a `translate`, segnaposto compresi. */
function fakeModel(translate: (text: string) => string, calls: unknown[] = []): TranslationModel {
  return {
    run(_model, inputs) {
      calls.push(inputs);
      const messages = inputs.messages as { role: string; content: string }[];
      const { reason } = JSON.parse(messages.at(-1)?.content ?? '{}') as { reason: string };
      return Promise.resolve({ response: { reason: translate(reason) } });
    },
  };
}

describe('traduzione inglese delle penalità', () => {
  it('protegge vetture, articoli, tempi e sigle dei regolamenti e li rimette al loro posto', () => {
    const masked = protectTerms('La vettura #54 (giro 1:34.065) viola l’art. 2.5.5.3.1 del C.d.C. e il Reg. Tec.');
    expect(masked.text).toBe('La vettura [[2]] (giro [[1]]) viola l’art. [[3]] del [[4]] e il [[5]]');
    expect(masked.protectedTerms).toEqual(['1:34.065', '#54', '2.5.5.3.1', 'C.d.C.', 'Reg. Tec.']);

    const termByIndex = new Map(masked.protectedTerms.map((term, index) => [index + 1, term] as const));
    expect(restoreTerms('Car [[2]] (lap [[1]]) breaches Art. [[3]] of the [[4]] and the [[5]]', termByIndex)).toBe(
      'Car #54 (lap 1:34.065) breaches Art. 2.5.5.3.1 of the C.d.C. and the Reg. Tec.',
    );
    // Un segnaposto perso, ripetuto o inventato invalida la traduzione.
    expect(restoreTerms('Car [[2]] breaches Art. [[3]] of the [[4]] and the [[5]]', termByIndex)).toBeNull();
    expect(restoreTerms('Car [[2]] [[2]] (lap [[1]]) Art. [[3]] [[4]] [[5]]', termByIndex)).toBeNull();
    expect(restoreTerms('Car [[2]] (lap [[1]]) Art. [[3]] [[4]] [[5]] [[9]]', termByIndex)).toBeNull();
  });

  it('in inglese le sigle dei regolamenti diventano C. C. e Tech. Reg.', () => {
    expect(englishProtectedTerm('C.d.C.')).toBe('C. C.');
    expect(englishProtectedTerm('Reg. Tec.')).toBe('Tech. Reg.');
    expect(englishProtectedTerm('Reg.Tec.')).toBe('Tech. Reg.');
    expect(englishProtectedTerm('#54')).toBe('#54');
  });

  it('una motivazione vuota non chiede nulla al modello', async () => {
    expect(await translatePenaltyToEnglish(undefined, '')).toEqual({ reason: '' });
  });

  it('manda al modello solo la motivazione con i segnaposto e rimette i termini protetti', async () => {
    const calls: unknown[] = [];
    const model = fakeModel(
      (text) => text.replace('la vettura', 'car').replace('frena tardivamente a Curva 13, colpendo', 'brakes late into Turn 13, hitting').replace(' (art. ', ' (Art. ').replace(' del ', ' of the '),
      calls,
    );
    const english = await translatePenaltyToEnglish(model, 'la vettura #54 frena tardivamente a Curva 13, colpendo la vettura #53 (art. 2.4 del C.d.C.).');
    expect(english).toEqual({ reason: 'car #54 brakes late into Turn 13, hitting la vettura #53 (Art. 2.4 of the C. C.).' });
    const sent = calls[0] as { messages: { content: string }[]; response_format: { type: string } };
    expect(sent.response_format.type).toBe('json_schema');
    expect(JSON.parse(sent.messages[1]?.content ?? '')).toEqual({
      reason: 'la vettura [[1]] frena tardivamente a Curva 13, colpendo la vettura [[2]] (art. [[3]] del [[4]]).',
    });
    expect(sent.messages[0]?.content).toContain('Curva 13 → Turn 13');
    expect(sent.messages[0]?.content).toContain('Regolamento Tecnico → Technical Regulations');
  });

  it('scarta la traduzione se il modello perde un termine protetto, sbaglia la risposta o non risponde', async () => {
    const reason = 'la vettura #46 urta la vettura #21';
    expect(await translatePenaltyToEnglish(fakeModel((text) => text.replace('[[2]]', '21')), reason)).toBeNull();
    expect(await translatePenaltyToEnglish({ run: () => Promise.resolve({ response: 'non è JSON' }) }, reason)).toBeNull();
    expect(await translatePenaltyToEnglish({ run: () => Promise.reject(new Error('quota esaurita')) }, reason)).toBeNull();
    expect(await translatePenaltyToEnglish(fakeModel(() => ''), reason)).toBeNull();
    expect(await translatePenaltyToEnglish(undefined, reason)).toBeNull();
  });

  it('accetta la risposta del modello anche come testo JSON', async () => {
    const model: TranslationModel = { run: () => Promise.resolve({ response: '{"reason":"car [[1]] hits car [[2]]"}' }) };
    expect(await translatePenaltyToEnglish(model, 'la vettura #46 urta la vettura #21')).toEqual({ reason: 'car #46 hits car #21' });
  });
});
