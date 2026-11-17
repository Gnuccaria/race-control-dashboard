import { TEST_CHAMPIONSHIPS } from '@shared/testChampionships';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/renderWithRouter';
import { testCarId } from '@/test/testCars';
import { fetchCrews } from '@/features/crews/services/crewApi';
import { createChampionship, deleteChampionships, fetchChampionship, fetchChampionships, updateChampionship } from './services/championshipApi';

vi.mock('@/features/auth/services/desktopBridge');
vi.mock('@/features/auth/services/discordApi');
vi.mock('@/features/crews/services/crewApi');

const [JAPAN, FIE] = TEST_CHAMPIONSHIPS as [(typeof TEST_CHAMPIONSHIPS)[number], (typeof TEST_CHAMPIONSHIPS)[number]];

describe('Crea campionato', () => {
  beforeEach(() => {
    vi.mocked(createChampionship).mockReset();
  });

  it('nome, durate con lo stint (fino a tre) e vetture ammesse con le caselle; poi salva', async () => {
    vi.mocked(createChampionship).mockResolvedValue({
      isSuccess: true,
      value: { id: 3, name: 'GT3 Sprint', durations: [{ hours: 2, stintMinutes: 60 }], carIds: [1, 3], createdAt: '2026-11-17T00:00:00Z' },
    });
    const user = userEvent.setup();
    renderApp('/campionati/crea-campionato');
    const createButton = await screen.findByRole('button', { name: 'Crea campionato' });
    expect(createButton).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Nome del campionato' }), 'GT3 Sprint');
    // Durata: ore e minuti dello stint; accanto quanti stint e cambi pilota ne vengono.
    await user.type(screen.getByRole('textbox', { name: 'Ore di gara della durata 1' }), '2');
    await user.type(screen.getByRole('textbox', { name: 'Minuti dello stint della durata 1' }), '45');
    expect(screen.getByText('Stint da 60 a 180 minuti.')).toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Minuti dello stint della durata 1' }));
    await user.type(screen.getByRole('textbox', { name: 'Minuti dello stint della durata 1' }), '70');
    expect(screen.getByText('La gara deve dividersi in stint interi.')).toBeInTheDocument();
    await user.clear(screen.getByRole('textbox', { name: 'Minuti dello stint della durata 1' }));
    await user.type(screen.getByRole('textbox', { name: 'Minuti dello stint della durata 1' }), '60');
    expect(screen.getByText('2 stint · 1 cambio pilota')).toBeInTheDocument();

    // Al massimo tre durate; la X toglie una riga.
    const addDuration = screen.getByRole('button', { name: 'Aggiungi una durata' });
    await user.click(addDuration);
    await user.click(addDuration);
    expect(screen.queryByRole('button', { name: 'Aggiungi una durata' })).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Ore di gara della durata 2' }), '2');
    expect(screen.getByText('Indica sia le ore sia lo stint.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Minuti dello stint della durata 2' }), '120');
    expect(screen.getByText('Durata già inserita.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Togli la durata 2' }));
    // La terza riga, lasciata vuota, non conta e non blocca la creazione.

    // Vetture: senza nessuna non si crea.
    expect(createButton).toBeDisabled();
    // Vetture: caselle di spunta nell'elenco a discesa, scelte mostrate come clip nel campo.
    const carPicker = screen.getByRole('button', { name: 'Vetture ammesse' });
    // Il riquadro con le clip contiene la freccia che apre l'elenco.
    const carField = carPicker.parentElement as HTMLElement;
    await user.click(carPicker);
    await user.click(await screen.findByRole('checkbox', { name: 'Audi' }));
    await user.click(screen.getByRole('checkbox', { name: 'Ferrari' }));
    expect(within(carField).getByText('Audi')).toBeInTheDocument();
    expect(within(carField).getByText('Ferrari')).toBeInTheDocument();
    // La X della clip toglie la vettura (e toglie la spunta).
    await user.click(screen.getByRole('button', { name: 'Togli Ferrari' }));
    expect(within(carField).queryByText('Ferrari')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Ferrari' })).not.toBeChecked();
    // Il filtro Gruppo restringe l'elenco; le clip mostrano sempre tutte le vetture scelte.
    await user.click(screen.getByRole('checkbox', { name: 'Porsche' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Gruppo delle vetture' }), 'Gr.3');
    expect(screen.getAllByRole('checkbox').map((checkbox) => checkbox.getAttribute('aria-label'))).toEqual(['Audi', 'BMW', 'Ferrari', 'Lamborghini']);
    expect(within(carField).getByText('Porsche')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Gruppo delle vetture' }), '');
    await user.click(carPicker);
    await user.click(screen.getByRole('checkbox', { name: 'Porsche' }));
    expect(screen.queryByRole('textbox', { name: 'Vetture, una per riga' })).not.toBeInTheDocument();
    await user.click(createButton);

    expect(await screen.findByText('Campionato «GT3 Sprint» creato.')).toBeInTheDocument();
    expect(createChampionship).toHaveBeenCalledWith({ name: 'GT3 Sprint', durations: [{ hours: 2, stintMinutes: 60 }], carIds: [testCarId('Audi')] });
    // Il form torna vuoto.
    expect(screen.getByRole('textbox', { name: 'Nome del campionato' })).toHaveValue('');
  });

  it("mostra l'errore del server (nome già usato) e conserva i dati", async () => {
    vi.mocked(createChampionship).mockResolvedValue({ isSuccess: false, errorKind: 'duplicate-championship-name' });
    const user = userEvent.setup();
    renderApp('/campionati/crea-campionato');
    await user.type(await screen.findByRole('textbox', { name: 'Nome del campionato' }), 'Cool1 FIE Championship');
    await user.type(screen.getByRole('textbox', { name: 'Ore di gara della durata 1' }), '6');
    await user.type(screen.getByRole('textbox', { name: 'Minuti dello stint della durata 1' }), '60');
    await user.click(screen.getByRole('button', { name: 'Vetture ammesse' }));
    await user.click(await screen.findByRole('checkbox', { name: 'BMW' }));
    await user.click(screen.getByRole('button', { name: 'Crea campionato' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già un campionato con questo nome.');
    expect(screen.getByRole('textbox', { name: 'Nome del campionato' })).toHaveValue('Cool1 FIE Championship');
  });
});

describe('Gestisci campionato', () => {
  beforeEach(() => {
    vi.mocked(fetchChampionships).mockResolvedValue({ isSuccess: true, value: TEST_CHAMPIONSHIPS });
  });

  it('mostra i campionati con durate e vetture; il clic destro seleziona ed Elimina chiede conferma', async () => {
    vi.mocked(deleteChampionships).mockResolvedValue({ isSuccess: true, value: 1 });
    const user = userEvent.setup();
    renderApp('/campionati/gestisci-campionati');

    const table = await screen.findByRole('table', { name: 'Campionati salvati' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([JAPAN.name, FIE.name]);
    expect(within(rows[1] as HTMLElement).getByText('6 ore · stint 60 min')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('6 vetture')).toBeInTheDocument();

    await user.pointer({ keys: '[MouseRight]', target: rows[0] as HTMLElement });
    expect(screen.getByText('1 campionato selezionato')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    const dialog = screen.getByRole('dialog', { name: 'Eliminare 1 campionato?' });
    expect(dialog).toHaveTextContent('Gli equipaggi collegati perdono il campionato');
    await user.click(within(dialog).getByRole('button', { name: 'Elimina' }));

    expect(await screen.findByText('1 campionato eliminato.')).toBeInTheDocument();
    expect(deleteChampionships).toHaveBeenCalledWith([JAPAN.id]);
  });

  it('spiega perché non si elimina un campionato con gare', async () => {
    vi.mocked(deleteChampionships).mockResolvedValue({ isSuccess: false, errorKind: 'championship-has-races' });
    const user = userEvent.setup();
    renderApp('/campionati/gestisci-campionati');
    const table = await screen.findByRole('table', { name: 'Campionati salvati' });
    await user.pointer({ keys: '[MouseRight]', target: within(table).getAllByRole('row')[2] as HTMLElement });
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    expect(await screen.findByText(/Un campionato con gare salvate non si può eliminare/)).toBeInTheDocument();
  });

  it('il dettaglio si apre in sola lettura e si modifica dopo "Modifica"', async () => {
    vi.mocked(fetchChampionship).mockResolvedValue({ isSuccess: true, value: { ...JAPAN, carIds: [testCarId('Nissan'), testCarId('Audi')] } });
    // La Nissan è l'auto di un equipaggio dell'All Japan GT: non si può togliere.
    vi.mocked(fetchCrews).mockResolvedValue({
      isSuccess: true,
      value: [{ id: 1, name: 'Apex', number: 12, championships: [{ championship: JAPAN.name, carId: testCarId('Nissan') }], color: '#E10600', createdAt: '' }],
    });
    vi.mocked(updateChampionship).mockImplementation((_id, draft) => Promise.resolve({ isSuccess: true, value: { ...JAPAN, ...draft } }));
    const user = userEvent.setup();
    renderApp('/campionati/gestisci-campionati');
    await user.click(await screen.findByRole('link', { name: `Apri i dettagli di ${JAPAN.name}` }));

    const nameInput = await screen.findByRole('textbox', { name: 'Nome del campionato' });
    expect(nameInput).toHaveAttribute('readonly');
    expect(screen.getByRole('textbox', { name: 'Ore di gara della durata 1' })).toHaveValue('3');
    expect(screen.getByText('2 stint · 1 cambio pilota')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vetture ammesse' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Modifica' }));
    await user.clear(nameInput);
    await user.type(nameInput, 'Super GT');
    await user.click(screen.getByRole('button', { name: 'Aggiungi una durata' }));
    await user.type(screen.getByRole('textbox', { name: 'Ore di gara della durata 2' }), '6');
    await user.type(screen.getByRole('textbox', { name: 'Minuti dello stint della durata 2' }), '120');
    await user.click(screen.getByRole('button', { name: 'Vetture ammesse' }));
    expect(screen.getByRole('checkbox', { name: 'Nissan' })).toBeDisabled();
    // La vettura usata non ha la X; le altre sì.
    expect(screen.queryByRole('button', { name: 'Togli Nissan' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Togli Audi' })).toBeInTheDocument();
    expect(screen.getByText('Usate da almeno un equipaggio, non si possono togliere: Nissan.')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Audi' }));
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    expect(await screen.findByText('Modifiche salvate.')).toBeInTheDocument();
    expect(updateChampionship).toHaveBeenCalledWith(JAPAN.id, {
      name: 'Super GT',
      durations: [
        { hours: 3, stintMinutes: 90 },
        { hours: 6, stintMinutes: 120 },
      ],
      carIds: [testCarId('Nissan')],
    });
  });
});
