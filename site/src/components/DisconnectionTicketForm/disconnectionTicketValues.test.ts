import { normalizeTicketGapText, parseTicketGap } from '@shared/disconnectionTicketRules';
import { describe, expect, it } from 'vitest';
import { checkTicketForm, EMPTY_TICKET_VALUES } from './disconnectionTicketValues';

const values = (overrides: Partial<typeof EMPTY_TICKET_VALUES>) => ({ position: '3', gap: '00:01:23.456', disconnectedOnLap: '12', ...overrides });

describe('modulo del ticket di disconnessione', () => {
  it('è pronto con tutti i campi validi', () => {
    expect(checkTicketForm(values({})).ticket).toEqual({ position: 3, gapMs: 83_456, disconnectedOnLap: 12 });
    expect(checkTicketForm(values({ gap: '1:23,4' })).ticket?.gapMs).toBe(83_400);
  });

  it('in P1 il distacco è dalla P2', () => {
    expect(checkTicketForm(values({ position: '1' })).isLeader).toBe(true);
    expect(checkTicketForm(values({ position: '2' })).isLeader).toBe(false);
  });

  it('segnala posizione fuori da 1–14, distacco non valido e giro non valido', () => {
    expect(checkTicketForm(values({ position: '15' }))).toMatchObject({ isPositionInvalid: true, ticket: null });
    expect(checkTicketForm(values({ position: '0' })).isPositionInvalid).toBe(true);
    expect(checkTicketForm(values({ gap: '1:99' }))).toMatchObject({ isGapInvalid: true, ticket: null });
    expect(checkTicketForm(values({ disconnectedOnLap: '1000' })).isLapInvalid).toBe(true);
    expect(checkTicketForm(values({ disconnectedOnLap: '' })).ticket).toBeNull();
    expect(checkTicketForm(EMPTY_TICKET_VALUES)).toMatchObject({ isPositionInvalid: false, isGapInvalid: false, isLapInvalid: false, ticket: null });
  });

  it('distacco: numero intero = secondi, decimali solo dopo punto o virgola, HH:MM:SS o HH.MM.SS', () => {
    const cases: [string, number][] = [
      ['83', 83_000],
      ['5', 5_000],
      ['83,5', 83_500],
      ['83.5', 83_500],
      ['1:23', 83_000],
      ['1:23.456', 83_456],
      ['1:23,456', 83_456],
      ['00:01:23.456', 83_456],
      ['00:01:23,456', 83_456],
      ['00.01.23.456', 83_456],
      ['12.34.56.789', 45_296_789],
      ['01.23.456', 83_456],
      ['1.23,456', 83_456],
      ['3600', 3_600_000],
      ['12:34.56', 754_560],
    ];
    for (const [text, milliseconds] of cases) expect([text, parseTicketGap(text)]).toEqual([text, milliseconds]);
    for (const text of ['83.', '83,1234', '1:2', '1:60', '1:23.45.6', '12.34:56', '1,2,3', 'abc', '1:02:03:04', '1234567']) {
      expect([text, Number.isNaN(parseTicketGap(text))]).toEqual([text, true]);
    }
    expect(parseTicketGap('  ')).toBeNull();
    expect(normalizeTicketGapText('83,5')).toBe('00:01:23.500');
    expect(normalizeTicketGapText('12.34.56.789')).toBe('12:34:56.789');
    expect(normalizeTicketGapText('1:60')).toBe('1:60');
  });
});
