import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthSession } from '@/features/auth/authSessionStore';
import * as desktopBridge from '@/features/auth/services/desktopBridge';
import { setThemePreference } from '@/features/theme/themePreferenceStore';
import { renderApp } from '@/test/renderWithRouter';

vi.mock('@/features/auth/services/desktopBridge');
vi.mock('@/features/auth/services/discordApi');

describe('applicazione', () => {
  beforeEach(() => {
    setThemePreference('system');
  });

  it("accoglie l'utente e mostra le sezioni con una card per ogni strumento", () => {
    renderApp('/');

    expect(screen.getByRole('heading', { level: 1, name: /Niko/ })).toBeInTheDocument();
    const sectionHeadings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(sectionHeadings).toEqual(['Gestisci campionato', 'Crea documentazione', 'Strumenti della Direzione Gara', 'Strumenti dei Commissari Sportivi']);

    expect(screen.getByRole('link', { name: /Aggiungi equipaggio/ })).toHaveAttribute('href', '/campionato/aggiungi-equipaggio');
    expect(screen.getByRole('link', { name: /Gestisci equipaggio/ })).toHaveAttribute('href', '/campionato/gestisci-equipaggi');
    expect(screen.getByRole('link', { name: /Gestisci ordini di arrivo/ })).toHaveAttribute('href', '/campionato/ordini-di-arrivo');
    expect(screen.getByRole('link', { name: /Calcolatore di giri/ })).toHaveAttribute('href', '/strumenti/calcolatore-giri');
    expect(screen.getByRole('link', { name: /Calcolatore deficit BoP/ })).toHaveAttribute('href', '/strumenti/deficit-bop');
    expect(screen.getByRole('link', { name: /Calcolatore disconnessioni/ })).toHaveAttribute(
      'href',
      '/strumenti/calcolatore-disconnessioni',
    );
    expect(screen.getByRole('link', { name: /Gestisci proteste/ })).toHaveAttribute('href', '/commissari/proteste');
    expect(screen.getByRole('link', { name: /Gestisci cambi pilota/ })).toHaveAttribute('href', '/commissari/cambi-pilota');
  });


  it.each([
    ['/strumenti/deficit-bop', 'Calcolatore deficit BoP'],
    ['/strumenti/calcolatore-disconnessioni', 'Calcolatore disconnessioni'],
    ['/campionato/aggiungi-equipaggio', 'Aggiungi equipaggio'],
  ])('apre %s direttamente', async (toolPath, toolName) => {
    renderApp(toolPath);
    expect(await screen.findByRole('heading', { level: 1, name: toolName })).toBeInTheDocument();
  });

  it('apre lo strumento dalla sua card e torna alla home', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(screen.getByRole('link', { name: /Calcolatore di giri/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Calcolatore di giri' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Tutti gli strumenti' }));
    expect(screen.getByRole('heading', { level: 1, name: /Niko/ })).toBeInTheDocument();
  });

  it('attiva e disattiva la modalità notte dalla tendina utente', async () => {
    const user = userEvent.setup();
    renderApp('/');

    const nightModeSwitch = screen.getByRole('switch', { name: /Modalità notte/ });
    expect(nightModeSwitch).not.toBeChecked();

    await user.click(nightModeSwitch);
    expect(nightModeSwitch).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe('dark');

    await user.click(screen.getByRole('button', { name: "Usa l'impostazione del dispositivo" }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(nightModeSwitch).not.toBeChecked();
  });

  it('mostra avatar e nome Discord nella tendina utente ed esce dopo la conferma', async () => {
    const user = userEvent.setup();
    vi.mocked(desktopBridge.readSavedRefreshToken).mockResolvedValue(null);
    vi.mocked(desktopBridge.deleteSavedRefreshToken).mockResolvedValue();
    renderApp('/');

    expect(screen.getByRole('button', { name: 'Menu utente di Niko' })).toBeInTheDocument();
    expect(screen.getByText('@niko_99')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Esci' }));
    const confirmDialog = screen.getByRole('dialog', { name: 'Vuoi uscire?' });

    await user.click(within(confirmDialog).getByRole('button', { name: 'Esci' }));
    expect(getAuthSession()).toEqual({ status: 'signed-out', errorKind: null });
    expect(desktopBridge.deleteSavedRefreshToken).toHaveBeenCalled();
  });

  it('chiudendo la conferma con "Torna indietro" resta dentro', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(screen.getByRole('button', { name: 'Esci' }));
    await user.click(screen.getByRole('button', { name: 'Torna indietro' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getAuthSession()).toMatchObject({ status: 'signed-in' });
  });

  it("cambia la lingua dell'intera app dalla tendina", async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.selectOptions(screen.getByLabelText('Lingua'), 'English');
    expect(screen.getByText('Pick a tool to get started.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Lap calculator/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Language'), 'Deutsch');
    expect(screen.getByText('Wähle ein Werkzeug, um loszulegen.')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('de');
  });

  it('mostra una pagina dedicata per gli indirizzi inesistenti', () => {
    renderApp('/strumenti/inesistente');

    expect(screen.getByRole('heading', { name: 'Pagina non trovata' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Torna alla home' })).toHaveAttribute('href', '/');
  });
});
