import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { fetchTicketAvailability, saveTicketAvailability } from '../../services/ticketApi';
import { TicketAvailabilitySwitch } from './TicketAvailabilitySwitch';

vi.mock('../../services/ticketApi');

describe('interruttore dei ticket dal sito', () => {
  it('mostra lo stato salvato, lo cambia sul server e torna com’era se il salvataggio non riesce', async () => {
    vi.mocked(fetchTicketAvailability).mockResolvedValue({ isSuccess: true, value: { isOpen: true } });
    vi.mocked(saveTicketAvailability).mockResolvedValue({ isSuccess: true, value: { isOpen: false } });
    const user = userEvent.setup();
    render(<TicketAvailabilitySwitch />);

    const toggle = await screen.findByRole('switch', { name: /Ticket dal sito/ });
    expect(toggle).toBeChecked();
    expect(screen.getByText(/Aperto: i piloti possono inviare/)).toBeInTheDocument();

    await user.click(toggle);
    expect(saveTicketAvailability).toHaveBeenCalledWith({ isOpen: false });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText(/Chiuso: sul sito la card dei ticket è disattivata/)).toBeInTheDocument();

    vi.mocked(saveTicketAvailability).mockResolvedValue({ isSuccess: false, errorKind: 'server-unreachable' });
    await user.click(toggle);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });
});
