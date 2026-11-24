import type { Protest } from '@shared/protestRules';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOpenTickets } from '@/features/disconnection-tickets/services/ticketApi';
import { renderApp } from '@/test/renderWithRouter';
import { ProtestReviewPanel } from './ProtestReviewPanel';
import { protestStore } from './protestStore';
import { fetchProtest, fetchProtests, saveProtestReview } from './services/protestApi';

vi.mock('@/features/auth/services/desktopBridge');
vi.mock('@/features/auth/services/discordApi');
vi.mock('@/features/disconnection-tickets/services/ticketApi');
vi.mock('./services/protestApi');

const protest = (id: number, change: Partial<Protest> = {}): Protest => ({
  id,
  crew: { id: 1, number: 16, name: 'Vez Team Lime' },
  championship: 'Cool1 FIE Championship',
  race: { id: 7, name: '6 Ore di Monza', round: 3, championship: 'Cool1 FIE Championship' },
  session: 'race',
  stint: 2,
  lap: 14,
  corner: '7',
  description: 'Contatto in staccata.',
  youtubeVideoId: null,
  otherCrews: [],
  video: null,
  status: 'open',
  rejectionReason: null,
  penalty: null,
  reviewedAt: null,
  submittedByName: 'Niko',
  submittedByUsername: 'niko_99',
  createdAt: '2026-11-16T20:00:00.000Z',
  ...change,
});

describe('Esito della protesta', () => {
  const withOtherCrew = (change: Partial<Protest> = {}) => protest(3, { otherCrews: [{ id: 2, number: 44, name: 'Firestarter Project' }], ...change });

  it('respinta: la motivazione è obbligatoria; la conferma avvisa che è definitiva e poi il pannello resta in sola lettura', async () => {
    const rejected = withOtherCrew({ status: 'rejected', rejectionReason: 'Contatto di gara.', reviewedAt: '2026-11-17T10:00:00.000Z' });
    vi.mocked(saveProtestReview).mockResolvedValue({ isSuccess: true, value: rejected });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<ProtestReviewPanel protest={withOtherCrew()} onSaved={onSaved} />);

    // L'interruttore parte spento: la protesta sarebbe accolta, con la sezione Penalità.
    expect(screen.getByRole('switch', { name: /Respingi protesta/ })).not.toBeChecked();
    expect(screen.getByRole('heading', { name: 'Penalità' })).toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Respingi protesta/ }));
    expect(screen.queryByRole('heading', { name: 'Penalità' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Motivazione del rifiuto' }), 'Contatto di gara.');
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    const dialog = screen.getByRole('dialog', { name: 'Respingere la protesta?' });
    expect(dialog).toHaveTextContent('La decisione è definitiva');
    await user.click(within(dialog).getByRole('button', { name: 'Conferma' }));

    expect(saveProtestReview).toHaveBeenCalledWith(3, { decision: 'rejected', reason: 'Contatto di gara.' });
    expect(onSaved).toHaveBeenCalledWith(rejected);
    rerender(<ProtestReviewPanel protest={rejected} onSaved={onSaved} />);
    expect(screen.getByText('Esito salvato.')).toBeInTheDocument();
    expect(screen.getByText('Protesta respinta: la decisione è definitiva.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Motivazione del rifiuto' })).toHaveValue('Contatto di gara.');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('accolta: vetture della protesta già compilate; violazione, documento e motivazione obbligatori', async () => {
    const accepted = withOtherCrew({
      status: 'accepted',
      penalty: { id: 9, crews: [{ crewId: 1, decision: null }, { crewId: 2, decision: 'time-5' }], violation: '2.5.1', document: 'code-of-conduct', reason: 'Tamponamento.' },
    });
    vi.mocked(saveProtestReview).mockResolvedValue({ isSuccess: true, value: accepted });
    const user = userEvent.setup();
    const { rerender } = render(<ProtestReviewPanel protest={withOtherCrew()} onSaved={vi.fn()} />);

    // Le vetture coinvolte sono quelle della protesta e non si cambiano: ognuna ha la sua decisione.
    expect(screen.getByRole('button', { name: /Vetture coinvolte/ })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Decisione per la vettura #16' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Decisione per la vettura #44' }), '+5 secondi');
    const saveButton = screen.getByRole('button', { name: 'Salva' });
    await user.type(screen.getByRole('textbox', { name: 'Violazione' }), '2.5.1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Documento' }), 'Codice di Condotta');
    expect(saveButton).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Motivazione' }), 'Tamponamento.');
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);
    await user.click(within(screen.getByRole('dialog', { name: 'Accogliere la protesta?' })).getByRole('button', { name: 'Conferma' }));

    expect(saveProtestReview).toHaveBeenCalledWith(3, {
      decision: 'accepted',
      penalty: {
        crews: [
          { crewId: 1, decision: null },
          { crewId: 2, decision: 'time-5' },
        ],
        violation: '2.5.1',
        document: 'code-of-conduct',
        reason: 'Tamponamento.',
      },
    });
    rerender(<ProtestReviewPanel protest={accepted} onSaved={vi.fn()} />);
    expect(screen.getByText(/Protesta accolta: la decisione è definitiva/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Violazione' })).toHaveValue('2.5.1');
    expect(screen.getByRole('combobox', { name: 'Decisione per la vettura #44' })).toBeDisabled();
  });

  it('una protesta senza gara (mandata prima) si può solo respingere', () => {
    render(<ProtestReviewPanel protest={protest(4, { race: null })} onSaved={vi.fn()} />);
    expect(screen.getByText(/si può solo respingere/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Motivazione del rifiuto' })).toBeInTheDocument();
  });
});

describe('Campanella delle proteste (Commissari Sportivi)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(fetchOpenTickets).mockResolvedValue({ isSuccess: true, value: [] });
  });

  it('conta le proteste in esame non lette, le elenca e il clic segna come letta solo quella', async () => {
    vi.mocked(fetchProtests).mockResolvedValue({ isSuccess: true, value: [protest(3), protest(2), protest(1, { status: 'rejected', rejectionReason: '' })] });
    await protestStore.refresh();
    const user = userEvent.setup();
    renderApp('/');

    expect(await screen.findByRole('button', { name: 'Notifiche: 2 nuove' })).toBeInTheDocument();
    expect(document.title).toMatch(/^\(2\) /);
    expect(screen.getByText('Proteste in esame')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Protesta #3/ })).toHaveTextContent('#16 Vez Team LimeStint 2 · Giro 14 · Curva 7');
    expect(screen.getByRole('button', { name: /Protesta #3/ })).toHaveTextContent('Nuova');
    expect(screen.queryByRole('button', { name: /Protesta #1/ })).not.toBeInTheDocument();

    vi.mocked(fetchProtest).mockResolvedValue({ isSuccess: true, value: protest(2) });
    await user.click(screen.getByRole('button', { name: /Protesta #2/ }));
    expect(await screen.findByRole('heading', { level: 1, name: /Protesta #2/ })).toBeInTheDocument();
    // Letta solo la #2: la #3 resta nuova.
    expect(screen.getByRole('button', { name: 'Notifiche: 1 nuova' })).toBeInTheDocument();
    expect(document.title).toMatch(/^\(1\) /);
    expect(screen.getByRole('button', { name: /Protesta #3/ })).toHaveTextContent('Nuova');
    expect(screen.getByRole('button', { name: /Protesta #2/ })).not.toHaveTextContent('Nuova');
    expect(localStorage.getItem('protests:read-ids')).toBe('[2]');
  });
});
