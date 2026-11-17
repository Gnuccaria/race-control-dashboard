import { describe, expect, it } from 'vitest';
import {
  findCrewNameIssue,
  normalizeCrewColor,
  normalizeCrewText,
  parseCrewNumber,
  sanitizeCrewNumberInput,
  toCrewNameKey,
  validateCrewDraft, normalizeDiscordChannelId, normalizeDiscordRoleId } from './crewRules';

const COMPLETE_CREW = { name: 'Team', number: 1, carId: 1, championship: 'Cool1 FIE Championship', color: '#E10600' };

describe('regole equipaggio', () => {
  it('accetta parole di lettere (anche accentate) e cifre separate da spazi', () => {
    expect(findCrewNameIssue('Era GT Team')).toBeNull();
    expect(findCrewNameIssue('Sim Racing Café')).toBeNull();
    expect(findCrewNameIssue('VRA Motorsport by Phoenix Team Racing')).toBeNull();
    expect(findCrewNameIssue('  Team   Rosso  ')).toBeNull();
  });

  it('rifiuta simboli, nomi vuoti e oltre 48 caratteri', () => {
    expect(findCrewNameIssue('')).toBe('required');
    expect(findCrewNameIssue('   ')).toBe('required');
    expect(findCrewNameIssue('Team-Rosso')).toBe('invalid-characters');
    expect(findCrewNameIssue('<script>')).toBe('invalid-characters');
    expect(findCrewNameIssue('a'.repeat(48))).toBeNull();
    expect(findCrewNameIssue('a'.repeat(49))).toBe('too-long');
  });

  it('normalizza spazi e composizione dei caratteri', () => {
    expect(normalizeCrewText('  GT   Tribe \t Team ')).toBe('GT Tribe Team');
    expect(normalizeCrewText('Café')).toBe('Café');
  });

  it('il campionato deve essere uno di quelli previsti', () => {
    expect(validateCrewDraft({ ...COMPLETE_CREW, championship: 'Serie X' })).toEqual({
      isValid: false,
      issues: { championship: 'invalid' },
    });
  });

  it('nel campo numero tiene solo cifre, al massimo tre', () => {
    expect(sanitizeCrewNumberInput('12a3')).toBe('123');
    expect(sanitizeCrewNumberInput('-5')).toBe('5');
    expect(sanitizeCrewNumberInput('1e3')).toBe('13');
    expect(sanitizeCrewNumberInput('12345')).toBe('123');
  });

  it('interpreta numeri da 0 a 999', () => {
    expect(parseCrewNumber('0')).toBe(0);
    expect(parseCrewNumber('007')).toBe(7);
    expect(parseCrewNumber('999')).toBe(999);
    expect(parseCrewNumber('')).toBeNull();
    expect(parseCrewNumber('1000')).toBeNull();
  });

  it('confronta i nomi senza distinguere maiuscole, minuscole e spazi in più', () => {
    expect(toCrewNameKey('GT Tribe')).toBe(toCrewNameKey('gt  tribe '));
  });

  it('convalida un equipaggio completo e lo restituisce in forma canonica', () => {
    expect(
      validateCrewDraft({ name: ' Team  Rosso ', number: 44, carId: 3, championship: 'Cool1 FIE Championship', color: '#e10600' }),
    ).toEqual({
      isValid: true,
      crew: { name: 'Team Rosso', number: 44, carId: 3, championship: 'Cool1 FIE Championship', color: '#E10600', discordChannelId: null, discordRoleId: null },
    });
  });

  it("auto, campionato e colore sono obbligatori per form e API, facoltativi per l'importazione", () => {
    expect(validateCrewDraft({ name: 'Team', number: 1, championship: '', color: '' })).toEqual({
      isValid: false,
      issues: { carId: 'required', championship: 'required', color: 'required' },
    });
    expect(validateCrewDraft({ name: 'Team', number: 1 }, { areDetailsRequired: false })).toEqual({
      isValid: true,
      crew: { name: 'Team', number: 1, carId: null, championship: null, color: null, discordChannelId: null, discordRoleId: null },
    });
    expect(validateCrewDraft({ name: 'Team', number: 1, carId: 'Fiat' }, { areDetailsRequired: false })).toEqual({
      isValid: false,
      issues: { carId: 'invalid' },
    });
  });

  it('il colore viene salvato come esadecimale maiuscolo', () => {
    expect(normalizeCrewColor('#e10600')).toBe('#E10600');
    expect(normalizeCrewColor(' 00a3e0 ')).toBe('#00A3E0');
    expect(normalizeCrewColor('#FFF')).toBeNull();
    expect(normalizeCrewColor('rosso')).toBeNull();
    expect(validateCrewDraft({ ...COMPLETE_CREW, color: '#ff8000' })).toMatchObject({
      crew: { color: '#FF8000' },
    });
    expect(validateCrewDraft({ ...COMPLETE_CREW, color: 'blu' })).toEqual({
      isValid: false,
      issues: { color: 'invalid' },
    });
  });

  it('elenca tutti i problemi di dati non validi o manomessi', () => {
    expect(validateCrewDraft({ name: 'Team-Rosso', number: 1000, carId: 0, championship: 42, color: '#FFF' })).toEqual({
      isValid: false,
      issues: { name: 'invalid-characters', number: 'invalid', carId: 'invalid', championship: 'invalid', color: 'invalid' },
    });
    expect(validateCrewDraft({ ...COMPLETE_CREW, number: 4.5 })).toMatchObject({ isValid: false });
    expect(validateCrewDraft('non un oggetto')).toMatchObject({ isValid: false });
  });

  it('canale Discord facoltativo: ID o link del canale, altrimenti non valido', () => {
    const channel = '1571641908688588999';
    expect(normalizeDiscordChannelId(` ${channel} `)).toBe(channel);
    expect(normalizeDiscordChannelId(`https://discord.com/channels/1569698028938600458/${channel}`)).toBe(channel);
    expect(normalizeDiscordChannelId(`https://discord.com/channels/1569698028938600458/${channel}/1571641908688500000`)).toBe(channel);
    expect(normalizeDiscordChannelId('canale-16')).toBeNull();
    expect(normalizeDiscordChannelId('1234')).toBeNull();
    const crewWith = (discordChannelId: unknown) => validateCrewDraft({ ...COMPLETE_CREW, discordChannelId });
    expect(crewWith(channel)).toMatchObject({ isValid: true, crew: { discordChannelId: channel } });
    expect(crewWith('')).toMatchObject({ isValid: true, crew: { discordChannelId: null, discordRoleId: null } });
    expect(crewWith(null)).toMatchObject({ isValid: true, crew: { discordChannelId: null, discordRoleId: null } });
    expect(crewWith('generale')).toEqual({ isValid: false, issues: { discordChannelId: 'invalid' } });
  });

  it('ruolo Discord facoltativo: ID o menzione del ruolo, altrimenti non valido', () => {
    const role = '1571641908688588963';
    expect(normalizeDiscordRoleId(` ${role} `)).toBe(role);
    expect(normalizeDiscordRoleId(`<@&${role}>`)).toBe(role);
    expect(normalizeDiscordRoleId('#16 Vez Team Lime')).toBeNull();
    expect(normalizeDiscordRoleId(`<@${role}>`)).toBeNull();
    const crewWith = (discordRoleId: unknown) => validateCrewDraft({ ...COMPLETE_CREW, discordRoleId });
    expect(crewWith(role)).toMatchObject({ isValid: true, crew: { discordRoleId: role } });
    expect(crewWith('')).toMatchObject({ isValid: true, crew: { discordRoleId: null } });
    expect(crewWith('@Vez')).toEqual({ isValid: false, issues: { discordRoleId: 'invalid' } });
  });
});
