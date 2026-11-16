import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '@/test/renderWithRouter';
import { LapCalculator } from './LapCalculator';

const getLapsToSet = () => screen.getByRole('status', { name: 'Giri da impostare nella prossima lobby' });

describe('<LapCalculator />', () => {
  it('mostra i risultati del foglio con i valori di esempio', () => {
    renderWithRouter(<LapCalculator />);

    expect(getLapsToSet()).toHaveTextContent('29');
    expect(screen.getByText('In ritardo')).toBeInTheDocument();
    expect(screen.getByText('di 5 min 0 s')).toBeInTheDocument();
  });

  it("riconosce l'ultima lobby quando cambia il formato gara", async () => {
    const user = userEvent.setup();
    renderWithRouter(<LapCalculator />);

    await user.click(screen.getByRole('radio', { name: /3 ore/ }));

    expect(screen.getByText('di 2')).toBeInTheDocument();
    expect(screen.getByText(/Questa è l'ultima lobby/)).toBeInTheDocument();
  });

  it('ricalcola lo stato quando cambia l’orario corrente', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LapCalculator />);

    // In italiano l'orario è a 24 ore: un menu per le ore e uno per i minuti.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Orario corrente: Ore' }), '21');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Orario corrente: Minuti' }), '00');
    expect(screen.queryByRole('combobox', { name: 'Orario corrente: AM/PM' })).not.toBeInTheDocument();

    expect(screen.getByText('In orario')).toBeInTheDocument();
  });

  it('cambia lobby con i pulsanti dello stepper', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LapCalculator />);

    await user.click(screen.getByRole('button', { name: 'Lobby successiva' }));

    expect(screen.getByLabelText('Numero lobby')).toHaveValue(6);
    expect(screen.getByRole('button', { name: 'Lobby successiva' })).toBeDisabled();
  });

  it('spiega come correggere un giro medio non valido', async () => {
    const user = userEvent.setup();
    renderWithRouter(<LapCalculator />);

    const averageLapInput = screen.getByLabelText('Giro medio');
    await user.clear(averageLapInput);

    expect(averageLapInput).toHaveAttribute('aria-invalid', 'true');
    expect(averageLapInput).toHaveAccessibleDescription('Inserisci un giro medio maggiore di 0.');
    expect(getLapsToSet()).toHaveTextContent('–');
  });
});
