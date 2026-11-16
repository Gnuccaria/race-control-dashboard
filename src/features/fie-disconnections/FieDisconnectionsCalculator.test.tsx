import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { chooseTrack } from '@/test/chooseTrack';
import { renderWithRouter } from '@/test/renderWithRouter';
import { FieDisconnectionsCalculator } from './FieDisconnectionsCalculator';

const getWaitingTime = () => screen.getByRole('status', { name: 'Tempo di attesa totale' });

describe('<FieDisconnectionsCalculator />', () => {
  it('senza tracciato chiede di sceglierlo; poi usa la sua lunghezza (esempio del foglio, P2–P14)', async () => {
    const user = userEvent.setup();
    renderWithRouter(<FieDisconnectionsCalculator />);

    expect(screen.getByText('Scegli un tracciato: la sua lunghezza serve per il calcolo.')).toBeInTheDocument();

    await chooseTrack(user, { continent: 'Asia', track: 'Suzuka Circuit', configuration: 'Completo' });
    expect(screen.getByRole('button', { name: 'Tracciato' })).toHaveTextContent('Suzuka Circuit - Completo');
    expect(screen.getByText('Lunghezza usata nel calcolo: 5,807 km')).toBeInTheDocument();
    expect(getWaitingTime()).toHaveTextContent('3 min 53 s');
    expect(screen.getByRole('spinbutton', { name: 'Distacco dal leader' })).toHaveValue(43);
  });

  it('segnala un tracciato senza lunghezza', async () => {
    const user = userEvent.setup();
    renderWithRouter(<FieDisconnectionsCalculator />);

    await chooseTrack(user, { continent: 'Asia', track: 'Tsukuba Circuit' });
    expect(screen.getByText('Per questo tracciato manca la lunghezza: aggiungila nel file delle piste.')).toBeInTheDocument();
  });

  it('per la P1 confronta con la P2 e aggiunge l’ingresso in pit stall', async () => {
    const user = userEvent.setup();
    renderWithRouter(<FieDisconnectionsCalculator />);
    await chooseTrack(user, { continent: 'Asia', track: 'Suzuka Circuit', configuration: 'Completo' });

    await user.click(screen.getByRole('radio', { name: /P1/ }));
    const gapInput = screen.getByRole('spinbutton', { name: 'Distacco dalla P2' });
    await user.clear(gapInput);
    await user.type(gapInput, '0');
    const lapInput = screen.getByLabelText('Disconnessione al giro');
    await user.clear(lapInput);
    await user.type(lapInput, '0');

    expect(getWaitingTime()).toHaveTextContent('3 min 25 s');
    expect(screen.getByText('Ingresso in pit stall', { selector: 'dt' })).toBeInTheDocument();
  });

  it('non mostra attese negative quando il distacco copre la penalità', async () => {
    const user = userEvent.setup();
    renderWithRouter(<FieDisconnectionsCalculator />);
    await chooseTrack(user, { continent: 'Asia', track: 'Suzuka Circuit', configuration: 'Completo' });

    await user.click(screen.getByRole('radio', { name: /P1/ }));
    const gapInput = screen.getByRole('spinbutton', { name: 'Distacco dalla P2' });
    await user.clear(gapInput);
    await user.type(gapInput, '600');

    expect(getWaitingTime()).toHaveTextContent('0 min 0 s');
    expect(screen.getByText(/nessuna attesa/)).toBeInTheDocument();
  });
});
