import { describe, expect, it } from 'vitest';
import { appAccessFromRoles, getAvatarUrl, hasRole, toUserProfile } from './discordProfile';

describe('profilo Discord', () => {
  it('usa il nome visualizzato e, se manca, lo username', () => {
    expect(toUserProfile({ id: '1', username: 'niko_99', global_name: 'Niko', avatar: null }).displayName).toBe('Niko');
    expect(toUserProfile({ id: '1', username: 'niko_99', global_name: null, avatar: null }).displayName).toBe('niko_99');
  });

  it("costruisce l'URL dell'avatar personalizzato", () => {
    expect(getAvatarUrl({ id: '80351110224678912', username: 'nelly', global_name: null, avatar: '8342729096ea3675442027381ff50dfe' })).toBe(
      'https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.png?size=128',
    );
  });

  it("senza avatar usa quello predefinito calcolato dall'ID: (id >> 22) % 6", () => {
    expect(getAvatarUrl({ id: '80351110224678912', username: 'nelly', global_name: null, avatar: null })).toBe(
      'https://cdn.discordapp.com/embed/avatars/5.png',
    );
  });

  it('verifica il ruolo richiesto', () => {
    const guildMember = { user: { id: '1', username: 'a', global_name: null, avatar: null }, roles: ['10', '20'] };
    expect(hasRole(guildMember, '20')).toBe(true);
    expect(hasRole(guildMember, '30')).toBe(false);
  });

  it('ricava le parti dell’app dai ruoli: Organizzazione, Direzione Gara, Commissari Sportivi, tutte o nessuna', () => {
    expect(appAccessFromRoles(['1569700040602292346'])).toEqual({ organization: true, raceControl: false, stewards: false });
    expect(appAccessFromRoles(['1569716852886605844'])).toEqual({ organization: false, raceControl: true, stewards: false });
    expect(appAccessFromRoles(['1569718968183296130'])).toEqual({ organization: false, raceControl: false, stewards: true });
    expect(appAccessFromRoles(['1569700040602292346', '1569716852886605844', '1569718968183296130', 'altro'])).toEqual({ organization: true, raceControl: true, stewards: true });
    expect(appAccessFromRoles(['altro'])).toEqual({ organization: false, raceControl: false, stewards: false });
  });
});
