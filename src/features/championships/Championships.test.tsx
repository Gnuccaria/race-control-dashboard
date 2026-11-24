import { DEFAULT_SESSION_SETTINGS } from '@shared/sessionSettingsRules';
import { TEST_CHAMPIONSHIPS } from '@shared/testChampionships';
import { fireEvent, screen, within } from '@testing-library/react';
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

type TestUser = ReturnType<typeof userEvent.setup>;

/** Scheda Gestione stint: l'orario di partenza di una durata (menu delle ore e dei minuti). */
async function chooseStartTime(user: TestUser, durationTitle: string, hour: string, minute: string) {
  await user.click(screen.getByRole('tab', { name: /Gestione stint/ }));
  const duration = screen.getByRole('region', { name: durationTitle });
  await user.selectOptions(within(duration).getByRole('combobox', { name: 'Orario di partenza: Ore' }), hour);
  await user.selectOptions(within(duration).getByRole('combobox', { name: 'Orario di partenza: Minuti' }), minute);
}

/** Scheda Generale: anticipo e durata delle qualifiche, finestre delle proteste (menu con valori fissi). */
async function chooseProtestTimes(user: TestUser, times: { advance?: string; duration?: string; qualifying?: string; race?: string }) {
  await user.click(screen.getByRole('tab', { name: /Generale/ }));
  if (times.advance) await user.selectOptions(screen.getByRole('combobox', { name: 'Anticipo delle qualifiche' }), times.advance);
  if (times.duration) await user.selectOptions(screen.getByRole('combobox', { name: 'Durata delle qualifiche' }), times.duration);
  if (times.qualifying) await user.selectOptions(screen.getByRole('combobox', { name: 'Proteste dopo le qualifiche' }), times.qualifying);
  if (times.race) await user.selectOptions(screen.getByRole('combobox', { name: 'Proteste dopo la gara' }), times.race);
}

const PROTEST_TIMES = { qualifying: { advanceHours: 24, minutes: 30, protestHours: 1 }, raceProtestHours: 48 };

describe('Crea campionato', () => {
  beforeEach(() => {
    vi.mocked(createChampionship).mockReset();
  });

  it('nome, durate con lo stint (fino a tre) e vetture ammesse con le caselle; poi salva', async () => {
    vi.mocked(createChampionship).mockResolvedValue({
      isSuccess: true,
      value: {
        id: 3,
        name: 'GT3 Sprint',
        durations: [{ hours: 2, stintMinutes: 60, startTime: '21:00' }],
        carIds: [1, 3],
        createdAt: '2026-11-17T00:00:00Z',
        sessionSettings: DEFAULT_SESSION_SETTINGS,
        protestTimes: PROTEST_TIMES,
      },
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
    // Senza l'orario di partenza non si crea: la scheda Gestione stint lo segnala.
    expect(createButton).toBeDisabled();
    expect(screen.getByRole('tab', { name: /Gestione stint/ })).toHaveTextContent('Gestione stint (da completare)');

    // Gestione stint: per ogni durata l'orario di partenza; gli orari degli stint si calcolano da soli.
    await chooseStartTime(user, 'Gara di 2 ore · stint da 60 minuti', '21', '30');
    const stints = screen.getByRole('list', { name: 'Orari degli stint della gara di 2 ore' });
    expect(within(stints).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Stint 121:30', 'Stint 222:30']);
    // Qualifiche e proteste: obbligatori; qualifiche e loro proteste devono finire prima della gara.
    expect(createButton).toBeDisabled();
    await chooseProtestTimes(user, { advance: '1 ora', duration: '30 minuti', qualifying: '1 ora', race: '2 giorni' });
    expect(screen.getByText(/finirebbero dopo la partenza della gara/)).toBeInTheDocument();
    expect(createButton).toBeDisabled();
    expect(within(screen.getByRole('combobox', { name: 'Proteste dopo la gara' })).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Scegli',
      '6 ore',
      '12 ore',
      '1 giorno',
      '2 giorni',
      '3 giorni',
      '5 giorni',
      '7 giorni',
    ]);
    await chooseProtestTimes(user, { advance: '1 giorno' });
    expect(screen.queryByText(/finirebbero dopo la partenza della gara/)).not.toBeInTheDocument();
    expect(createButton).toBeEnabled();

    // Impostazioni di sessione: la prima scelta della gara passa alla qualifica, poi la qualifica resta indipendente.
    await user.click(screen.getByRole('tab', { name: 'Impostazioni di sessione' }));
    expect(screen.getByRole('heading', { name: 'Impostazioni gara' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Turbo – Gara' }), 'strong');
    expect(screen.getByRole('combobox', { name: 'Turbo – Qualifica' })).toHaveValue('strong');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Turbo – Qualifica' }), 'weak');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Turbo – Gara' }), 'off');
    expect(screen.getByRole('combobox', { name: 'Turbo – Qualifica' })).toHaveValue('weak');
    // Le voci senza senso in qualifica hanno solo la gara.
    expect(screen.queryByRole('slider', { name: 'Numero minimo di soste ai box – Qualifica' })).not.toBeInTheDocument();
    // Rifornimento solo con consumo sopra 0x, come nel gioco.
    expect(screen.queryByRole('slider', { name: 'Velocità di rifornimento – Gara' })).not.toBeInTheDocument();
    const fuel = screen.getByRole('slider', { name: 'Consumo carburante – Gara' });
    expect(fuel).toHaveAttribute('aria-valuetext', 'No');
    fireEvent.change(fuel, { target: { value: '3' } });
    expect(fuel).toHaveAttribute('aria-valuetext', '3x');
    expect(screen.getByRole('slider', { name: 'Velocità di rifornimento – Gara' })).toBeInTheDocument();
    // Gomme "Da corsa": mescole con "Tutte"; le richieste solo tra quelle utilizzabili.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Gomme utilizzabili – Gara' }), 'racing');
    const usable = screen.getByRole('group', { name: 'Gomme e tipi utilizzabili – Gara' });
    expect(within(usable).getByRole('checkbox', { name: 'Tutte' })).toBeChecked();
    await user.click(within(usable).getByRole('checkbox', { name: 'Morbide' }));
    expect(within(usable).getByRole('checkbox', { name: 'Tutte' })).not.toBeChecked();
    const required = screen.getByRole('group', { name: 'Tipo di gomme richieste – Gara' });
    expect(within(required).getAllByRole('checkbox').map((checkbox) => checkbox.getAttribute('aria-label') ?? checkbox.parentElement?.textContent)).toEqual([
      'Dure',
      'Medie',
    ]);
    await user.click(within(required).getByRole('checkbox', { name: 'Medie' }));
    await user.click(createButton);

    expect(await screen.findByText('Campionato «GT3 Sprint» creato.')).toBeInTheDocument();
    const sent = vi.mocked(createChampionship).mock.calls[0]?.[0];
    expect(sent).toMatchObject({
      name: 'GT3 Sprint',
      durations: [{ hours: 2, stintMinutes: 60, startTime: '21:30' }],
      carIds: [testCarId('Audi')],
      protestTimes: PROTEST_TIMES,
    });
    expect(sent?.sessionSettings.race).toMatchObject({
      boost: 'off',
      fuelConsumption: 3,
      usableTyres: 'racing',
      usableCompounds: ['hard', 'medium'],
      requiredCompounds: ['medium'],
    });
    expect(sent?.sessionSettings.qualifying).toMatchObject({ boost: 'weak', fuelConsumption: 3, usableTyres: 'racing' });
    expect(sent?.sessionSettings.qualifying).not.toHaveProperty('minPitStops');
    // Il form torna vuoto.
    expect(screen.getByRole('textbox', { name: 'Nome del campionato' })).toHaveValue('');
  }, 20_000);

  it("mostra l'errore del server (nome già usato) e conserva i dati", async () => {
    vi.mocked(createChampionship).mockResolvedValue({ isSuccess: false, errorKind: 'duplicate-championship-name' });
    const user = userEvent.setup();
    renderApp('/campionati/crea-campionato');
    await user.type(await screen.findByRole('textbox', { name: 'Nome del campionato' }), 'Cool1 FIE Championship');
    await user.type(screen.getByRole('textbox', { name: 'Ore di gara della durata 1' }), '6');
    await user.type(screen.getByRole('textbox', { name: 'Minuti dello stint della durata 1' }), '60');
    await user.click(screen.getByRole('button', { name: 'Vetture ammesse' }));
    await user.click(await screen.findByRole('checkbox', { name: 'BMW' }));
    await chooseStartTime(user, 'Gara di 6 ore · stint da 60 minuti', '20', '00');
    await chooseProtestTimes(user, { advance: '1 giorno', duration: '30 minuti', qualifying: '1 ora', race: '2 giorni' });
    await user.click(screen.getByRole('button', { name: 'Crea campionato' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già un campionato con questo nome.');
    await user.click(screen.getByRole('tab', { name: 'Generale' }));
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
    // Le durate salvate prima degli orari vanno completate con l'orario di partenza.
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    await chooseStartTime(user, 'Gara di 3 ore · stint da 90 minuti', '21', '00');
    await chooseStartTime(user, 'Gara di 6 ore · stint da 120 minuti', '18', '00');
    // Il campionato salvato prima non ha le qualifiche (le 48 ore della gara restano): vanno scelte.
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    await chooseProtestTimes(user, { advance: '1 giorno', duration: '30 minuti', qualifying: '1 ora' });
    expect(screen.getByRole('combobox', { name: 'Proteste dopo la gara' })).toHaveValue('48');
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    expect(await screen.findByText('Modifiche salvate.')).toBeInTheDocument();
    expect(updateChampionship).toHaveBeenCalledWith(JAPAN.id, {
      name: 'Super GT',
      durations: [
        { hours: 3, stintMinutes: 90, startTime: '21:00' },
        { hours: 6, stintMinutes: 120, startTime: '18:00' },
      ],
      carIds: [testCarId('Nissan')],
      sessionSettings: DEFAULT_SESSION_SETTINGS,
      protestTimes: PROTEST_TIMES,
    });
  });
});
