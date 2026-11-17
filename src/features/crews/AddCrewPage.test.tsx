import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from '@/test/renderWithRouter';
import { testCarId } from '@/test/testCars';
import { AddCrewPage } from './AddCrewPage';
import { createCrew } from './services/crewApi';

vi.mock('./services/crewApi');

const FIE = 'Cool1 FIE Championship';
const JAPAN = 'All Japan GT Championship';

const renderAddCrewPage = async () => {
  renderWithRouter(<AddCrewPage />);
  await screen.findByRole('combobox', { name: 'Aggiungi un campionato' });
  return {
    crewNameInput: screen.getByRole('textbox', { name: 'Nome equipaggio' }),
    crewNumberInput: screen.getByRole('textbox', { name: 'Numero equipaggio' }),
    createButton: screen.getByRole('button', { name: 'Crea equipaggio' }),
  };
};

/** Aggiunge un campionato e sceglie l'auto (le auto arrivano finte dal server: si aspetta che il menu sia pronto). */
async function addChampionship(user: ReturnType<typeof userEvent.setup>, championship: string, carName: string) {
  await user.selectOptions(screen.getByRole('combobox', { name: 'Aggiungi un campionato' }), championship);
  const carSelect = screen.getByRole('combobox', { name: `Auto nel ${championship}` });
  await within(carSelect).findByRole('option', { name: carName });
  await user.selectOptions(carSelect, carName);
}

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
    const { crewNameInput, crewNumberInput, createButton } = await renderAddCrewPage();

    expect(createButton).toBeDisabled();
    await user.type(crewNameInput, 'Era GT Team');
    await user.type(crewNumberInput, '7');
    // Un campionato senza auto blocca la creazione.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Aggiungi un campionato' }), FIE);
    expect(createButton).toBeDisabled();
    await within(screen.getByRole('combobox', { name: `Auto nel ${FIE}` })).findByRole('option', { name: 'Ferrari' });
    await user.selectOptions(screen.getByRole('combobox', { name: `Auto nel ${FIE}` }), 'Ferrari');
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

  it('i campionati si scelgono da una lista, ognuno con le auto di quel campionato; il colore obbligatorio non si può togliere', async () => {
    const user = userEvent.setup();
    const { crewNameInput, crewNumberInput, createButton } = await renderAddCrewPage();

    expect(screen.getByText('Nessun campionato')).toBeInTheDocument();
    await addChampionship(user, JAPAN, 'Nissan');
    // Nell'All Japan GT ci sono solo le auto di quel campionato.
    expect(within(screen.getByRole('combobox', { name: `Auto nel ${JAPAN}` })).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Seleziona un\'auto',
      'Nissan',
    ]);
    // Già scelto: nel menu resta solo l'altro campionato.
    expect(within(screen.getByRole('combobox', { name: 'Aggiungi un campionato' })).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Aggiungi un campionato',
      FIE,
    ]);
    await addChampionship(user, FIE, 'Audi');
    expect(screen.queryByRole('combobox', { name: 'Aggiungi un campionato' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Togli ${JAPAN}` }));
    expect(screen.queryByRole('combobox', { name: `Auto nel ${JAPAN}` })).not.toBeInTheDocument();
    // Anche senza campionati si può creare l'equipaggio.
    await user.click(screen.getByRole('button', { name: `Togli ${FIE}` }));
    await user.type(crewNameInput, 'Libero');
    await user.type(crewNumberInput, '9');
    await chooseColorFromPalette(user, '#E60000');
    expect(createButton).toBeEnabled();
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
        championships: [{ championship: FIE, carId: testCarId('Porsche') }],
        color: '#E60000',
        createdAt: '2026-11-13T10:00:00Z',
      },
    });
    const user = userEvent.setup();
    const { crewNameInput, crewNumberInput, createButton } = await renderAddCrewPage();

    await user.type(crewNameInput, '  Sim  Racing Café ');
    await user.type(crewNumberInput, '077');
    await addChampionship(user, FIE, 'Porsche');
    await addChampionship(user, JAPAN, 'Nissan');
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
      championships: [
        { championship: FIE, carId: testCarId('Porsche') },
        { championship: JAPAN, carId: testCarId('Nissan') },
      ],
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
    const { crewNameInput, crewNumberInput, createButton } = await renderAddCrewPage();

    await user.type(crewNameInput, 'Scuderia77');
    await user.type(crewNumberInput, '7');
    await addChampionship(user, FIE, 'Audi');
    await chooseColorFromPalette(user, '#E60000');
    await user.click(createButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già un equipaggio con questo numero.');
    expect(crewNameInput).toHaveValue('Scuderia77');
  });
});
