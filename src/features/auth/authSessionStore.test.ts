import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAuthSession,
  getSessionAccessToken,
  replaceAuthSessionForTests,
  restoreSavedSession,
  signInWithDiscord,
  signOut,
} from './authSessionStore';
import { AuthError } from './model/authErrors';
import * as desktopBridge from './services/desktopBridge';
import * as discordApi from './services/discordApi';

vi.mock('./services/desktopBridge');
vi.mock('./services/discordApi');

const REQUIRED_ROLE_ID = '1569716852886605844';
const DISCORD_USER = { id: '80351110224678912', username: 'niko_99', global_name: 'Niko', avatar: null };
const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1' };
const BROWSER_COMPLETION_PAGE = { title: 'Accesso completato', message: 'Puoi chiudere questa scheda.' };

/** Simula Discord che rimanda indietro lo stesso state ricevuto nella pagina di autorizzazione. */
function simulateDiscordRedirect() {
  vi.mocked(desktopBridge.authorizeInBrowser).mockImplementation((authorizeUrl) => {
    const sentState = new URL(authorizeUrl).searchParams.get('state') ?? '';
    return Promise.resolve(`/discord/callback?code=code-1&state=${sentState}`);
  });
}

function simulateGuildRoles(roles: string[]) {
  vi.mocked(discordApi.fetchGuildMember).mockResolvedValue({ user: DISCORD_USER, roles });
}

describe('sessione Discord', () => {
  beforeEach(() => {
    vi.mocked(desktopBridge.isDesktopApp).mockReturnValue(true);
    vi.mocked(desktopBridge.saveRefreshToken).mockResolvedValue();
    vi.mocked(desktopBridge.deleteSavedRefreshToken).mockResolvedValue();
    vi.mocked(discordApi.exchangeAuthorizationCode).mockResolvedValue(TOKENS);
    vi.mocked(discordApi.revokeToken).mockResolvedValue();
    replaceAuthSessionForTests({ status: 'restoring' });
  });

  it('entra con il ruolo richiesto e, senza "Ricorda", tiene il token solo in memoria', async () => {
    simulateDiscordRedirect();
    simulateGuildRoles([REQUIRED_ROLE_ID]);

    await signInWithDiscord({ rememberAccess: false, browserCompletionPage: BROWSER_COMPLETION_PAGE });

    expect(getAuthSession()).toMatchObject({ status: 'signed-in', user: { displayName: 'Niko', username: 'niko_99' } });
    expect(desktopBridge.saveRefreshToken).not.toHaveBeenCalled();
    expect(getSessionAccessToken()).toBe('access-1');
  });

  it('con "Ricorda l\'accesso" salva il token nell\'archivio sicuro', async () => {
    simulateDiscordRedirect();
    simulateGuildRoles([REQUIRED_ROLE_ID]);

    await signInWithDiscord({ rememberAccess: true, browserCompletionPage: BROWSER_COMPLETION_PAGE });

    expect(desktopBridge.saveRefreshToken).toHaveBeenCalledWith('refresh-1');
  });

  it('senza il ruolo resta sulla schermata di login con un errore e non salva nulla', async () => {
    simulateDiscordRedirect();
    simulateGuildRoles(['altro-ruolo']);

    await signInWithDiscord({ rememberAccess: true, browserCompletionPage: BROWSER_COMPLETION_PAGE });

    expect(getAuthSession()).toEqual({ status: 'signed-out', errorKind: 'missing-role' });
    expect(desktopBridge.saveRefreshToken).not.toHaveBeenCalled();
  });

  it("l'annullamento dall'app non mostra errori", async () => {
    vi.mocked(desktopBridge.authorizeInBrowser).mockRejectedValue('LOGIN_CANCELLED');

    await signInWithDiscord({ rememberAccess: false, browserCompletionPage: BROWSER_COMPLETION_PAGE });

    expect(getAuthSession()).toEqual({ status: 'signed-out', errorKind: null });
  });

  it("ripristina l'accesso ricordato ricontrollando il ruolo", async () => {
    vi.mocked(desktopBridge.readSavedRefreshToken).mockResolvedValue('refresh-saved');
    vi.mocked(discordApi.refreshTokens).mockResolvedValue({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    simulateGuildRoles([REQUIRED_ROLE_ID]);

    await restoreSavedSession();

    expect(getAuthSession()).toMatchObject({ status: 'signed-in' });
    expect(desktopBridge.saveRefreshToken).toHaveBeenCalledWith('refresh-2');
  });

  it("dimentica l'accesso ricordato se nel frattempo il ruolo è stato tolto", async () => {
    vi.mocked(desktopBridge.readSavedRefreshToken).mockResolvedValue('refresh-saved');
    vi.mocked(discordApi.refreshTokens).mockResolvedValue(TOKENS);
    simulateGuildRoles([]);

    await restoreSavedSession();

    expect(getAuthSession()).toEqual({ status: 'signed-out', errorKind: 'missing-role' });
    expect(desktopBridge.deleteSavedRefreshToken).toHaveBeenCalled();
  });

  it("offline conserva l'accesso ricordato per il prossimo avvio", async () => {
    vi.mocked(desktopBridge.readSavedRefreshToken).mockResolvedValue('refresh-saved');
    vi.mocked(discordApi.refreshTokens).mockRejectedValue(new AuthError('network'));

    await restoreSavedSession();

    expect(getAuthSession()).toEqual({ status: 'signed-out', errorKind: 'network' });
    expect(desktopBridge.deleteSavedRefreshToken).not.toHaveBeenCalled();
  });

  it("se Discord limita le richieste conserva l'accesso ricordato", async () => {
    vi.mocked(desktopBridge.readSavedRefreshToken).mockResolvedValue('refresh-saved');
    vi.mocked(discordApi.refreshTokens).mockResolvedValue({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    vi.mocked(discordApi.fetchGuildMember).mockRejectedValue(new AuthError('rate-limited'));

    await restoreSavedSession();

    expect(getAuthSession()).toEqual({ status: 'signed-out', errorKind: 'rate-limited' });
    expect(desktopBridge.saveRefreshToken).toHaveBeenCalledWith('refresh-2');
    expect(desktopBridge.deleteSavedRefreshToken).not.toHaveBeenCalled();
  });

  it('il logout invalida i token della sessione, cancella l\'accesso ricordato e torna al login', async () => {
    replaceAuthSessionForTests(
      { status: 'signed-in', user: { id: '1', username: 'niko_99', displayName: 'Niko', avatarUrl: '', access: { organization: false, raceControl: true, stewards: false } } },
      { accessToken: 'access-session', refreshToken: 'refresh-session' },
    );

    await signOut();

    expect(desktopBridge.deleteSavedRefreshToken).toHaveBeenCalled();
    expect(discordApi.revokeToken).toHaveBeenCalledWith('refresh-session');
    expect(getSessionAccessToken()).toBeNull();
    expect(getAuthSession()).toEqual({ status: 'signed-out', errorKind: null });
  });
});
