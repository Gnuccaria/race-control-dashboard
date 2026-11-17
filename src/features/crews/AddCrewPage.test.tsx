import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/renderWithRouter';
import { testCarId } from '@/test/testCars';
import { AddCrewPage } from './AddCrewPage';
import { createCrew } from './services/crewApi';

vi.mock('./services/crewApi');

/** Le auto arrivano (finte) dal server: si aspetta che il menu sia pronto. */
const renderAddCrewPage = async () => {
  renderWithRouter(<AddCrewPage />);
  await screen.findByRole('option', { name: 'Ferrari' });
  return {
    crewNameInput: screen.getByRole('textbox', { name: 'Nome equipaggio' }),
    crewNumberInput: screen.getByRole('textbox', { name: 'Numero equipaggio' }),
    carSelect: screen.getByRole('combobox', { name: 'Auto' }),
    championshipSelect: screen.getByRole('combobox', { name: 'Campionato' }),
    createButton: screen.getByRole('button', { name: 'Crea equipaggio' }),
  };
};

/** Apre il popup del colore, sceglie un colore della tabella e conferma. */
async function chooseColorFromPalette(user: ReturnType<typeof userEvent.setup>, paletteColor: string) {
  await user.click(screen.getByRole('button', { name: /Scegli il colore|Colore #/ }));
  const pickerDialog = screen.getByRole('dialog', { name: 'Scegli il colore' });
  await user.click(within(pickerDialog).getByRole('button', { name: paletteColor }));
  await user.click(within(pickerDialog).getByRole('button', { name: 'Conferma' }));
}

describe('Aggiungi equipaggio', () => {
  beforeEach(() => {
    vi.mocked(createCrew).mockReset();
  });

  it('attiva "Crea equipaggio" solo quando tutti i campi, colore compreso, sono validi', async () => {
    const user = userEvent.setup();
    const { crewNameInput, crewNumberInput, carSelect, championshipSelect, createButton } = await renderAddCrewPage();

    expect(createButton).toBeDisabled();
    await user.type(crewNameInput, 'Era GT Team');
    await user.type(crewNumberInput, '7');
    await user.selectOptions(carSelect, 'Ferrari');
    expect(createButton).toBeDisabled();

    await user.selectOptions(championshipSelect, 'Cool1 FIE Championship');
    expect(createButton).toBeDisabled();

    await chooseColorFromPalette(user, '#E60000');
    expect(createButton).toBeEnabled();

    await user.type(crewNameInput, '!');
    expect(screen.getByText(/solo lettere, numeri e spazi/i)).toBeInTheDocument();
    expect(createButton).toBeDisabled();
  });

  it('nel numero accetta solo cifre, al massimo tre', async () => {
    const user = userEvent.setup();
    const { crewNumberInput } = await renderAddCrewPage();

    await user.type(crewNumberInput, 'a1-2.b34');
    expect(crewNumberInput).toHaveValue('123');
  });

  it('il campionato si sceglie dal menu e il colore obbligatorio non si può togliere', async () => {
    const user = userEvent.setup();
    const { championshipSelect } = await renderAddCrewPage();

    expect(championshipSelect).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Seleziona un campionato' })).toBeDisabled();
    await chooseColorFromPalette(user, '#E60000');
    await user.click(screen.getByRole('button', { name: /Colore #E60000/ }));
    expect(screen.queryByRole('button', { name: 'Togli colore' })).not.toBeInTheDocument();
  });

  it('salva sul server, conferma e svuota il form', async () => {
    vi.mocked(createCrew).mockResolvedValue({
      isSuccess: true,
      value: {
        id: 1,
        name: 'Sim Racing Café',
        number: 77,
        carId: testCarId('Porsche'),
        championship: 'Cool1 FIE Championship',
        color: '#E60000',
        createdAt: '2026-11-13T10:00:00Z',
      },
    });
    const user = userEvent.setup();
    const { crewNameInput, crewNumberInput, carSelect, championshipSelect, createButton } = await renderAddCrewPage();

    await user.type(crewNameInput, '  Sim  Racing Café ');
    await user.type(crewNumberInput, '077');
    await user.selectOptions(carSelect, 'Porsche');
    await user.selectOptions(championshipSelect, 'Cool1 FIE Championship');
    await chooseColorFromPalette(user, '#E60000');
    expect(screen.getByRole('button', { name: /Colore #E60000/ })).toHaveStyle({ backgroundColor: '#E60000' });
    // Ruolo Discord facoltativo: una menzione non valida blocca il salvataggio, l'ID copiato da Discord va bene.
    const roleInput = screen.getByRole('textbox', { name: 'Ruolo Discord' });
    await user.type(roleInput, '@Sim Racing');
    await user.tab();
    expect(screen.getByText('Incolla l\'ID del ruolo (17–20 cifre) o la sua menzione (<@&…>).')).toBeInTheDocument();
    expect(createButton).toBeDisabled();
    await user.clear(roleInput);
    await user.type(roleInput, '<@&1571641908688588963>');
    await user.tab();
    expect(roleInput).toHaveValue('1571641908688588963');
    await user.click(createButton);

    expect(await screen.findByRole('status')).toHaveTextContent('Equipaggio «Sim Racing Café» creato.');
    expect(createCrew).toHaveBeenCalledWith({
      name: 'Sim Racing Café',
      number: 77,
      carId: testCarId('Porsche'),
      championship: 'Cool1 FIE Championship',
      color: '#E60000',
      discordChannelId: null,
      discordRoleId: '1571641908688588963',
    });
    expect(screen.getByRole('textbox', { name: 'Nome equipaggio' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Crea equipaggio' })).toBeDisabled();
  });

  it("mostra l'errore del server e conserva i dati inseriti", async () => {
    vi.mocked(createCrew).mockResolvedValue({ isSuccess: false, errorKind: 'duplicate-number' });
    const user = userEvent.setup();
    const { crewNameInput, crewNumberInput, carSelect, createButton } = await renderAddCrewPage();

    await user.type(crewNameInput, 'Scuderia77');
    await user.type(crewNumberInput, '7');
    await user.selectOptions(carSelect, 'Audi');
    // Oltre ai campionati c'è "Nessuno", per gli equipaggi che non ne usano nessuno.
    expect(within(screen.getByRole('combobox', { name: 'Campionato' })).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Seleziona un campionato',
      'Cool1 FIE Championship',
      'All Japan GT Championship',
      'Nessuno',
    ]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Campionato' }), 'Cool1 FIE Championship');
    await chooseColorFromPalette(user, '#E60000');
    await user.click(createButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già un equipaggio con questo numero.');
    expect(crewNameInput).toHaveValue('Scuderia77');
  });
});
