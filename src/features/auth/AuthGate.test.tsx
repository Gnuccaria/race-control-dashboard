import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { replaceAuthSessionForTests } from './authSessionStore';
import { AuthGate } from './AuthGate';
import * as desktopBridge from './services/desktopBridge';

vi.mock('./services/desktopBridge');

const renderGate = () =>
  render(
    <AuthGate>
      <p>Contenuto riservato</p>
    </AuthGate>,
  );

describe('<AuthGate />', () => {
  it("mostra l'attesa mentre verifica l'accesso ricordato", () => {
    replaceAuthSessionForTests({ status: 'restoring' });
    renderGate();

    expect(screen.getByRole('status')).toHaveTextContent("Verifica dell'accesso");
    expect(screen.queryByText('Contenuto riservato')).not.toBeInTheDocument();
  });

  it('senza login mostra solo il pulsante Discord e la scelta "Ricorda l\'accesso"', () => {
    replaceAuthSessionForTests({ status: 'signed-out', errorKind: null });
    renderGate();

    expect(screen.getByRole('button', { name: 'Accedi con Discord' })).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: /Ricorda l'accesso/ })).not.toBeChecked();
    expect(screen.queryByText('Contenuto riservato')).not.toBeInTheDocument();
  });

  it('spiega perché l\'accesso è stato negato a chi non ha il ruolo', () => {
    replaceAuthSessionForTests({ status: 'signed-out', errorKind: 'missing-role' });
    renderGate();

    expect(screen.getByRole('alert')).toHaveTextContent('non ha il ruolo richiesto');
  });

  it('durante il login disattiva il pulsante e permette di annullare', async () => {
    const user = userEvent.setup();
    vi.mocked(desktopBridge.cancelBrowserAuthorization).mockResolvedValue();
    replaceAuthSessionForTests({ status: 'signing-in' });
    renderGate();

    expect(screen.getByRole('button', { name: 'In attesa di Discord…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(desktopBridge.cancelBrowserAuthorization).toHaveBeenCalled();
  });

  it("fuori dall'app desktop spiega che il login non è disponibile", async () => {
    const user = userEvent.setup();
    vi.mocked(desktopBridge.isDesktopApp).mockReturnValue(false);
    replaceAuthSessionForTests({ status: 'signed-out', errorKind: null });
    renderGate();

    await user.click(screen.getByRole('button', { name: 'Accedi con Discord' }));
    expect(screen.getByRole('alert')).toHaveTextContent("solo nell'app desktop");
  });

  it('dopo il login mostra il contenuto riservato', () => {
    replaceAuthSessionForTests({
      status: 'signed-in',
      user: { id: '1', username: 'niko_99', displayName: 'Niko', avatarUrl: '', access: { organization: false, raceControl: true, stewards: false } },
    });
    renderGate();

    expect(screen.getByText('Contenuto riservato')).toBeInTheDocument();
  });
});
