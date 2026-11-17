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
  stint: 2,
  lap: 14,
  corner: '7',
  description: 'Contatto in staccata.',
  youtubeVideoId: null,
  otherCrews: [],
  video: null,
  status: 'open',
  rejectionReason: null,
  reviewedAt: null,
  submittedByName: 'Niko',
  submittedByUsername: 'niko_99',
  createdAt: '2026-11-16T20:00:00.000Z',
  ...change,
});

describe('Esito della protesta', () => {
  it('il rifiuto chiede conferma, avvisa che è definitivo e poi il pannello resta in sola lettura', async () => {
    const rejected = protest(3, { status: 'rejected', rejectionReason: 'Contatto di gara.', reviewedAt: '2026-11-17T10:00:00.000Z' });
    vi.mocked(saveProtestReview).mockResolvedValue({ isSuccess: true, value: rejected });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<ProtestReviewPanel protest={protest(3)} onSaved={onSaved} />);

    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    await user.click(screen.getByRole('switch', { name: /Respingi protesta/ }));
    await user.type(screen.getByRole('textbox', { name: 'Motivazione' }), 'Contatto di gara.');
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    const dialog = screen.getByRole('dialog', { name: 'Respingere la protesta?' });
    expect(dialog).toHaveTextContent('La decisione è definitiva');
    await user.click(within(dialog).getByRole('button', { name: 'Conferma' }));

    expect(saveProtestReview).toHaveBeenCalledWith(3, { isRejected: true, reason: 'Contatto di gara.' });
    expect(onSaved).toHaveBeenCalledWith(rejected);
    rerender(<ProtestReviewPanel protest={rejected} onSaved={onSaved} />);
    expect(screen.getByText('Esito salvato.')).toBeInTheDocument();
    expect(screen.getByText('Protesta respinta: la decisione è definitiva.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Motivazione' })).toHaveValue('Contatto di gara.');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salva' })).not.toBeInTheDocument();
  });

  it('una protesta già respinta senza motivazione si mostra in sola lettura', () => {
    render(<ProtestReviewPanel protest={protest(4, { status: 'rejected', rejectionReason: '' })} onSaved={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Motivazione' })).toHaveValue('Nessuna motivazione scritta.');
    expect(screen.queryByRole('button', { name: 'Salva' })).not.toBeInTheDocument();
  });
});

describe('Campanella delle proteste (Commissari Sportivi)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(fetchOpenTickets).mockResolvedValue({ isSuccess: true, value: [] });
  });

  it('conta le proteste nuove ancora in esame, le elenca e aprendo la tendina diventano viste', async () => {
    vi.mocked(fetchProtests).mockResolvedValue({ isSuccess: true, value: [protest(3), protest(2), protest(1, { status: 'rejected', rejectionReason: '' })] });
    await protestStore.refresh();
    const user = userEvent.setup();
    renderApp('/');

    const bell = await screen.findByRole('button', { name: 'Notifiche: 2 nuove' });
    expect(screen.getByText('Proteste in esame')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Protesta #3/ })).toHaveTextContent('#16 Vez Team LimeStint 2 · Giro 14 · Curva 7');
    expect(screen.queryByRole('button', { name: /Protesta #1/ })).not.toBeInTheDocument();

    // jsdom non apre i popover: si simula l'evento di apertura della tendina.
    const panel = document.getElementById(bell.getAttribute('popovertarget') ?? '') as HTMLElement;
    panel.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open', oldState: 'closed' }));
    expect(await screen.findByRole('button', { name: 'Notifiche' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Protesta #3/ })).toHaveTextContent('Nuova');
    expect(localStorage.getItem('protests:seen-up-to')).toBe('3');

    vi.mocked(fetchProtest).mockResolvedValue({ isSuccess: true, value: protest(2) });
    await user.click(screen.getByRole('button', { name: /Protesta #2/ }));
    expect(await screen.findByRole('heading', { level: 1, name: /Protesta #2/ })).toBeInTheDocument();
  });
});
