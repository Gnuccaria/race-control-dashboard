import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canUpdateApp, installAvailableUpdate, type UpdateProgress } from './appUpdater';
import { UpdateGate } from './UpdateGate';

vi.mock('./appUpdater', () => ({ canUpdateApp: vi.fn(), installAvailableUpdate: vi.fn() }));

describe("aggiornamento all'avvio", () => {
  beforeEach(() => {
    vi.mocked(canUpdateApp).mockReturnValue(true);
  });

  it("senza versioni nuove (o nel browser) l'app si apre normalmente", async () => {
    vi.mocked(installAvailableUpdate).mockResolvedValue(false);
    render(<UpdateGate>App</UpdateGate>);
    expect(await screen.findByText('App')).toBeInTheDocument();
    vi.mocked(canUpdateApp).mockReturnValue(false);
    render(<UpdateGate>Solo browser</UpdateGate>);
    expect(screen.getByText('Solo browser')).toBeInTheDocument();
  });

  it("con una versione nuova mostra la barra con la percentuale, poi l'installazione", async () => {
    let report: (progress: UpdateProgress) => void = () => undefined;
    vi.mocked(installAvailableUpdate).mockImplementation((onProgress) => {
      report = onProgress;
      return new Promise(() => undefined);
    });
    render(<UpdateGate>App</UpdateGate>);
    act(() => report({ version: '1.1.0', downloadedBytes: 0, totalBytes: null, phase: 'downloading' }));
    expect(screen.getByRole('heading', { name: 'Aggiornamento in corso' })).toBeInTheDocument();
    expect(screen.getByText('Installazione della versione 1.1.0')).toBeInTheDocument();
    expect(screen.queryByText('App')).not.toBeInTheDocument();
    act(() => report({ version: '1.1.0', downloadedBytes: 2_500_000, totalBytes: 10_000_000, phase: 'downloading' }));
    expect(screen.getByRole('status')).toHaveTextContent('25%');
    expect(screen.getByRole('progressbar', { name: "Avanzamento dell'aggiornamento" })).toHaveAttribute('value', '25');
    act(() => report({ version: '1.1.0', downloadedBytes: 10_000_000, totalBytes: 10_000_000, phase: 'installing' }));
    expect(screen.getByRole('status')).toHaveTextContent("Installazione… l'app si riavvierà da sola.");
  });
});
