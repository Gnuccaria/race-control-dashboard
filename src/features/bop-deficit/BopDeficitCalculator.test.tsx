import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithRouter } from '@/test/renderWithRouter';
import { BopDeficitCalculator } from './BopDeficitCalculator';

const getPenalty = () => screen.getByRole('status', { name: 'Penalità totale' });

describe('<BopDeficitCalculator />', () => {
  it('parte senza penalità, come il foglio vuoto', () => {
    renderWithRouter(<BopDeficitCalculator />);

    expect(getPenalty()).toHaveTextContent('0 s');
    expect(screen.getByText(/in linea con il BoP/)).toBeInTheDocument();
  });

  it('calcola la penalità per un’auto più leggera e più potente', async () => {
    const user = userEvent.setup();
    renderWithRouter(<BopDeficitCalculator />);

    await user.type(screen.getByLabelText('Peso da BoP'), '1300');
    await user.type(screen.getByLabelText('Peso effettivo'), '1290');
    await user.type(screen.getByLabelText('Potenza da BoP'), '500');
    await user.type(screen.getByLabelText('Potenza effettiva'), '505');
    await user.type(screen.getByLabelText('Effettuati'), '12');

    expect(getPenalty()).toHaveTextContent('90 s');
    expect(screen.getByText('Pari a')).toHaveTextContent('1 min 30 s');
  });
});
