import type { SavedCrew } from '@shared/crewRules';
import type { RaceSummary, SavedRace } from '@shared/raceRules';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCrews } from '@/features/crews/services/crewApi';
import { renderApp } from '@/test/renderWithRouter';
import { chooseTrack } from '@/test/chooseTrack';
import { testCarId } from '@/test/testCars';
import { createRace, deleteRaces, fetchRace, fetchRaces, updateRace, updateRaceDriverSwaps } from './services/raceApi';

vi.mock('@/features/auth/services/desktopBridge');
vi.mock('@/features/auth/services/discordApi');
vi.mock('@/features/crews/services/crewApi');
vi.mock('./services/raceApi');

/** Sceglie un orario "HH:MM" nei menu di ore e minuti (orologio a 24 ore dell'italiano). */
async function chooseTime(user: ReturnType<typeof userEvent.setup>, label: string, time: string) {
  const [hours = '', minutes = ''] = time.split(':');
  await user.selectOptions(screen.getByRole('combobox', { name: `${label}: Ore` }), String(Number(hours)));
  await user.selectOptions(screen.getByRole('combobox', { name: `${label}: Minuti` }), minutes);
}

const LIST_PATH = '/campionati/gare';
const CHAMPIONSHIP = 'Cool1 FIE Championship';

/** Equipaggio con l'Audi nel campionato indicato (null = nessun campionato). */
const crew = (id: number, name: string, number: number, championship: string | null = CHAMPIONSHIP, carId: number | null = testCarId('Audi')): SavedCrew => ({
  id,
  name,
  number,
  championships: championship === null ? [] : [{ championship: championship as SavedCrew['championships'][number]['championship'], carId }],
  color: '#E10600',
  createdAt: '2026-11-13T00:00:00Z',
});

const CREWS = [crew(1, 'Alfa Racing', 7), crew(2, 'Beta Corse', 12), crew(3, 'Fuori Campionato', 99, null)];

const summary = (id: number, round: number, raceDate: string): RaceSummary => ({
  id,
  name: null,
  championship: CHAMPIONSHIP,
  duration: 6,
  totalLaps: null,
  round,
  trackId: null,
  trackName: null,
  trackConfiguration: null,
  isTrackReversed: false,
  raceDate,
  updatedAt: '2026-11-13T10:00:00Z',
  startTime: '21:00',
  endDate: raceDate,
  endTime: '23:30',
});

const RACES = [summary(1, 1, '2026-09-14'), summary(2, 2, '2026-10-05')];

const shownRounds = () =>
  within(screen.getByRole('table', { name: 'Gare salvate' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1]?.textContent);

beforeEach(() => {
  vi.mocked(fetchCrews).mockResolvedValue({ isSuccess: true, value: CREWS });
  vi.mocked(fetchRaces).mockResolvedValue({ isSuccess: true, value: RACES });
});

describe('Gestisci ordini di arrivo: elenco', () => {
  it('mostra le gare dalla più recente, con il pulsante per crearne una', async () => {
    renderApp(LIST_PATH);

    expect(await screen.findByRole('table', { name: 'Gare salvate' })).toBeInTheDocument();
    expect(shownRounds()).toEqual(['2', '1']);
    expect(screen.getByRole('link', { name: 'Crea gara' })).toHaveAttribute('href', `${LIST_PATH}/nuova`);
    expect(screen.getByRole('combobox', { name: 'Tracciato' })).toBeDisabled();
  });

  it('filtra per data di inizio', async () => {
    const user = userEvent.setup();
    renderApp(LIST_PATH);
    await screen.findByRole('table');

    await user.type(screen.getByLabelText('Dal'), '2026-10-01');
    expect(shownRounds()).toEqual(['2']);
  });

  it('seleziona con il tasto destro ed elimina dopo la conferma', async () => {
    vi.mocked(deleteRaces).mockResolvedValue({ isSuccess: true, value: 1 });
    const user = userEvent.setup();
    renderApp(LIST_PATH);
    await screen.findByRole('table');

    const firstRoundRow = screen.getAllByRole('row').find((row) => within(row).queryAllByRole('cell')[1]?.textContent === '1');
    await user.pointer({ keys: '[MouseRight]', target: firstRoundRow as HTMLElement });
    vi.mocked(fetchRaces).mockResolvedValue({ isSuccess: true, value: [RACES[1] as RaceSummary] });
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Eliminare 1 gara?' })).getByRole('button', { name: 'Elimina' }));

    expect(deleteRaces).toHaveBeenCalledWith([1]);
    expect(await screen.findByText('1 gara eliminata.')).toBeInTheDocument();
  });
});

/** Riga dell'ordine di arrivo: il nome della riga non comprende più il testo del menu dell'equipaggio, si parte da quello. */
const resultRow = (position: number) =>
  screen.getByRole('combobox', { name: `Equipaggio in posizione ${position}` }).closest('tr') as HTMLElement;

describe('Nuova gara', () => {
  const pickCrew = async (user: ReturnType<typeof userEvent.setup>, position: number, crewName: string) => {
    await user.click(screen.getByRole('combobox', { name: `Equipaggio in posizione ${position}` }));
    await user.click(screen.getByRole('option', { name: new RegExp(crewName) }));
  };

  it('propone solo gli equipaggi del campionato, segnala i doppioni e salva', async () => {
    const savedRace: SavedRace = {
      ...summary(5, 3, '2026-11-08'),
      name: '6 Ore di Alsazia',
      duration: 12,
      results: [{ position: 1, crewId: 2, laps: 25, gapMs: null, carId: testCarId('Audi') }],
      driverSwaps: [],
    };
    vi.mocked(createRace).mockResolvedValue({ isSuccess: true, value: savedRace });
    vi.mocked(fetchRace).mockResolvedValue({ isSuccess: true, value: savedRace });
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/nuova`);

    const saveButton = await screen.findByRole('button', { name: 'Salva gara' });
    expect(saveButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tracciato' })).toHaveTextContent('Scegli un tracciato');

    // Il nome della gara è il primo campo ed è facoltativo.
    await user.type(screen.getByRole('textbox', { name: 'Nome della gara' }), '6 Ore di Alsazia');
    // La durata c'è sempre, ma resta disattivata finché non si sceglie il campionato.
    expect(screen.getByRole('combobox', { name: 'Durata' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Campionato' }), CHAMPIONSHIP);
    // Nel Cool1 FIE Championship la durata è obbligatoria, tra 6 e 12 ore.
    expect(screen.getByRole('combobox', { name: 'Durata' })).toBeEnabled();
    expect(within(screen.getByRole('combobox', { name: 'Durata' })).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Seleziona la durata',
      '6 ore',
      '12 ore',
    ]);
    await user.type(screen.getByRole('textbox', { name: 'Round' }), 'r3');
    expect(screen.getByRole('textbox', { name: 'Round' })).toHaveValue('3');

    // Data e orari in ora italiana, obbligatori; la data di fine segue quella di inizio; la fine dopo l'inizio.
    await user.type(screen.getByLabelText('Data di inizio'), '2026-11-08');
    expect(screen.getByLabelText('Data di fine')).toHaveValue('2026-11-08');
    // Orari con i menu di ore e minuti, a 24 ore in italiano (niente AM/PM).
    expect(screen.queryByRole('combobox', { name: 'Ora di inizio: AM/PM' })).not.toBeInTheDocument();
    await chooseTime(user, 'Ora di inizio', '20:00');
    await chooseTime(user, 'Ora di fine', '19:00');
    expect(screen.getByText('La fine deve essere dopo l\'inizio.')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Data di fine'));
    await user.type(screen.getByLabelText('Data di fine'), '2026-11-09');
    await chooseTime(user, 'Ora di fine', '08:00');
    expect(saveButton).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Durata' }), '12 ore');
    expect(saveButton).toBeEnabled();

    // Giri totali: facoltativi, solo cifre.
    await user.type(screen.getByRole('textbox', { name: 'Giri totali' }), '2a5');
    expect(screen.getByRole('textbox', { name: 'Giri totali' })).toHaveValue('25');

    // Tracciato: Continente → Tracciato → Configurazione; "al contrario" solo dove la configurazione lo prevede.
    await user.click(screen.getByRole('button', { name: 'Tracciato' }));
    const dialog = await screen.findByRole('dialog', { name: 'Scegli il tracciato' });
    expect(within(dialog).getByRole('combobox', { name: 'Tracciato' })).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Configurazione' })).toBeDisabled();
    await within(dialog).findByRole('option', { name: 'Asia' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Continente' }), 'Europa - Medio Oriente');
    expect(within(within(dialog).getByRole('combobox', { name: 'Tracciato' })).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Seleziona un tracciato',
      'Alsace',
      'Monza',
    ]);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tracciato' }), 'Monza');
    expect(within(dialog).getByRole('button', { name: 'Conferma' })).toBeDisabled();
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Configurazione' }), 'Senza chicane');
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(screen.getByRole('button', { name: 'Tracciato' })).toHaveTextContent('Scegli un tracciato');
    await chooseTrack(user, { continent: 'Europa - Medio Oriente', track: 'Alsace', isReversed: true });
    expect(screen.getByRole('button', { name: 'Tracciato' })).toHaveTextContent('Alsace - Villaggio al contrario');

    await user.click(screen.getByRole('tab', { name: 'Dettagli' }));
    await user.click(screen.getByRole('combobox', { name: 'Equipaggio in posizione 1' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Nessun equipaggio',
      '#7Alfa Racing',
      '#12Beta Corse',
    ]);
    await user.click(screen.getByRole('option', { name: /Beta Corse/ }));
    // La colonna Auto mostra l'auto attuale dell'equipaggio, che verrà salvata con la gara.
    expect(resultRow(1)).toHaveTextContent('Audi');

    await pickCrew(user, 2, 'Beta Corse');
    expect(screen.getByText('Già inserito in posizione 1.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Equipaggio in posizione 2' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('tab', { name: /Dettagli\s?\(contiene errori\)/ })).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    await pickCrew(user, 2, 'Nessun equipaggio');

    // Con un equipaggio inserito servono i giri completati (il campo accetta solo cifre).
    expect(saveButton).toBeDisabled();
    expect(screen.getByText('Inserisci i giri completati per 1 posizione.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Giri completati in posizione 2' })).toBeDisabled();
    // Più giri dei giri totali (25): errore finché non si corregge.
    await user.type(screen.getByRole('textbox', { name: 'Giri completati in posizione 1' }), '26');
    expect(screen.getByRole('alert')).toHaveTextContent('In 1 posizione i giri completati superano i giri totali (25).');
    expect(saveButton).toBeDisabled();
    await user.clear(screen.getByRole('textbox', { name: 'Giri completati in posizione 1' }));
    await user.type(screen.getByRole('textbox', { name: 'Giri completati in posizione 1' }), '2x5');
    expect(screen.getByRole('textbox', { name: 'Giri completati in posizione 1' })).toHaveValue('25');

    // Il primo non ha distacco: nella sua riga il campo non c'è.
    expect(screen.queryByRole('textbox', { name: 'Distacco in posizione 1' })).not.toBeInTheDocument();

    // La X svuota la riga intera.
    await pickCrew(user, 2, 'Alfa Racing');
    expect(screen.getByRole('button', { name: 'Svuota la posizione 2' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Svuota la posizione 2' }));
    expect(screen.getByRole('combobox', { name: 'Equipaggio in posizione 2' })).toHaveTextContent('Seleziona un equipaggio');
    expect(saveButton).toBeEnabled();

    // Distacco facoltativo dalla seconda posizione: minuti:secondi,millesimi; un formato sbagliato blocca il salvataggio.
    await pickCrew(user, 2, 'Alfa Racing');
    await user.type(screen.getByRole('textbox', { name: 'Giri completati in posizione 2' }), '24');
    const gapInput = screen.getByRole('textbox', { name: 'Distacco in posizione 2' });
    await user.type(gapInput, '1:65');
    expect(screen.getByRole('alert')).toHaveTextContent('Distacco non valido in 1 posizione');
    expect(saveButton).toBeDisabled();
    await user.clear(gapInput);
    await user.type(gapInput, '1:05,3');
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    expect(createRace).toHaveBeenCalledWith({
      name: '6 Ore di Alsazia',
      championship: CHAMPIONSHIP,
      duration: 12,
      totalLaps: 25,
      round: 3,
      trackId: 1,
      isTrackReversed: true,
      raceDate: '2026-11-08',
      startTime: '20:00',
      endDate: '2026-11-09',
      endTime: '08:00',
      results: [
        { position: 1, crewId: 2, laps: 25, gapMs: null },
        { position: 2, crewId: 1, laps: 24, gapMs: 65_300 },
      ],
      driverSwaps: [],
    });
    expect(await screen.findByText('Gara salvata.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '6 Ore di Alsazia' })).toBeInTheDocument();
    // Test lungo (tutto il form della gara): più tempo del predefinito quando i test girano in parallelo.
  }, 15_000);

  it('blocca il salvataggio se un equipaggio non ha un\'auto', async () => {
    vi.mocked(fetchCrews).mockResolvedValue({ isSuccess: true, value: [...CREWS, crew(4, 'Senza Auto', 30, CHAMPIONSHIP, null)] });
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/nuova`);

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Campionato' }), CHAMPIONSHIP);
    await user.click(screen.getByRole('tab', { name: 'Dettagli' }));
    await pickCrew(user, 1, 'Senza Auto');
    expect(resultRow(1)).toHaveTextContent('Senza auto');
    expect(screen.getByRole('alert')).toHaveTextContent("1 equipaggio non ha un'auto: assegnala in Gestisci equipaggio, poi torna qui.");
    expect(screen.getByRole('tab', { name: /Dettagli\s?\(contiene errori\)/ })).toBeInTheDocument();
  });

  it('mostra l’errore del server vicino al pulsante', async () => {
    vi.mocked(createRace).mockResolvedValue({ isSuccess: false, errorKind: 'duplicate-race-round' });
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/nuova`);

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Campionato' }), CHAMPIONSHIP);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Durata' }), '6 ore');
    await user.type(screen.getByRole('textbox', { name: 'Round' }), '1');
    await user.type(screen.getByLabelText('Data di inizio'), '2099-01-01');
    await chooseTime(user, 'Ora di inizio', '21:00');
    await chooseTime(user, 'Ora di fine', '23:00');
    await user.click(screen.getByRole('button', { name: 'Salva gara' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già una gara con questo round nello stesso campionato.');
  });
});

describe('Dettaglio gara', () => {
  const savedRace: SavedRace = {
    ...summary(1, 1, '2026-09-14'),
    // In P1 l'equipaggio 1 correva con la Ferrari; ora ha l'Audi.
    results: [
      { position: 1, crewId: 1, laps: 30, gapMs: null, carId: testCarId('Ferrari') },
      { position: 2, crewId: 2, laps: 29, gapMs: 12_045, carId: testCarId('Audi') },
    ],
    // Cambio 1 già salvato: la #12 (equipaggio 2) ha 7,5 secondi di penalità.
    driverSwaps: [
      { swap: 1, crewId: 1, pitInMs: 3_600_000, pitOutMs: 600_000, penaltyMs: null, isCancelled: false, notes: '' },
      { swap: 1, crewId: 2, pitInMs: 3_610_000, pitOutMs: 605_000, penaltyMs: 7_500, isCancelled: false, notes: 'Box lento' },
    ],
  };

  beforeEach(() => {
    vi.mocked(fetchRace).mockResolvedValue({ isSuccess: true, value: savedRace });
    vi.mocked(updateRace).mockReset();
  });

  it('mostra i dati in sola lettura e li salva dopo "Modifica"', async () => {
    // Il server risponde con la gara salvata: classifica (con le vetture) e cambi pilota restano quelli di prima.
    vi.mocked(updateRace).mockImplementation((_raceId, race) =>
      Promise.resolve({
        isSuccess: true,
        value: { ...savedRace, ...race, results: savedRace.results, driverSwaps: savedRace.driverSwaps, updatedAt: '2026-11-14T10:00:00Z' },
      }),
    );
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/1`);

    expect(await screen.findByRole('heading', { level: 1, name: `Round 1 – ${CHAMPIONSHIP}` })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Round' })).toHaveAttribute('readonly');
    await user.click(screen.getByRole('tab', { name: 'Dettagli' }));
    expect(screen.getByRole('combobox', { name: 'Equipaggio in posizione 1' })).toHaveTextContent('#7Alfa Racing');
    expect(screen.getByRole('combobox', { name: 'Equipaggio in posizione 1' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Giri completati in posizione 1' })).toHaveValue('30');
    expect(screen.getByRole('textbox', { name: 'Distacco in posizione 2' })).toHaveValue('12,045');
    // In sola lettura la X per svuotare le righe non c'è.
    expect(screen.queryByRole('button', { name: 'Svuota la posizione 1' })).not.toBeInTheDocument();
    // I campi in sola lettura non si raggiungono né col Tab né col clic.
    expect(screen.getByRole('textbox', { name: 'Giri completati in posizione 1' })).toHaveAttribute('tabindex', '-1');
    expect(resultRow(1)).toHaveTextContent('Ferrari');

    await user.click(screen.getByRole('button', { name: 'Modifica' }));
    await user.click(screen.getByRole('tab', { name: 'Anagrafica' }));
    await user.clear(screen.getByRole('textbox', { name: 'Round' }));
    await user.type(screen.getByRole('textbox', { name: 'Round' }), '4');
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    // Al server vanno solo posizione, equipaggio e giri: la vettura di ogni riga la decide lui.
    expect(updateRace).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        round: 4,
        duration: 6,
        results: savedRace.results.map(({ position, crewId, laps, gapMs }) => ({ position, crewId, laps, gapMs })),
        // I cambi pilota salvati tornano al server così come sono.
        driverSwaps: savedRace.driverSwaps.map(({ swap, crewId, pitInMs, pitOutMs, isCancelled, notes }) => ({
          swap,
          crewId,
          pitInMs,
          pitOutMs,
          isCancelled,
          notes,
        })),
      }),
    );
    expect(await screen.findByText('Modifiche salvate.')).toBeInTheDocument();
  });

  it('chiede conferma su "Annulla" e uscendo durante la modifica', async () => {
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/1`);

    await user.click(await screen.findByRole('button', { name: 'Modifica' }));
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Annullare le modifiche?' })).getByRole('button', { name: 'Continua a modificare' }),
    );
    expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Tutte le gare' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Uscire senza salvare?' })).getByRole('button', { name: 'Esci senza salvare' }),
    );
    expect(await screen.findByRole('table', { name: 'Gare salvate' })).toBeInTheDocument();
    expect(updateRace).not.toHaveBeenCalled();
  });

  it('Gestisci ordini di arrivo non ha più le schede Cambi pilota e Penalità', async () => {
    renderApp(`${LIST_PATH}/1`);
    expect(await screen.findByRole('tab', { name: 'Anagrafica' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Anagrafica', 'Dettagli']);
  });

  it('Cambi pilota (Gestisci cambi pilota dei Commissari): cinque cambi nel Cool1 FIE scelti dal menu, tempi formattati, salvati solo i cambi pilota', async () => {
    vi.mocked(updateRaceDriverSwaps).mockImplementation(() => Promise.resolve({ isSuccess: true, value: { ...savedRace, driverSwaps: [] } }));
    const user = userEvent.setup();
    renderApp('/commissari/cambi-pilota/1');

    // Solo la scheda Cambi pilota: nessuna barra delle schede.
    const swapPicker = await screen.findByRole('combobox', { name: 'Cambio pilota' });
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(within(swapPicker).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Da stint 1 a stint 2',
      'Da stint 2 a stint 3',
      'Da stint 3 a stint 4',
      'Da stint 4 a stint 5',
      'Da stint 5 a stint 6',
    ]);
    // Solo le vetture del campionato (#7 e #12), con i tempi salvati.
    const firstSwap = screen.getByRole('table', { name: 'Cambio 1: stint 1 → stint 2' });
    expect(within(firstSwap).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual(['#7', '#12']);
    expect(screen.getByRole('textbox', { name: 'Pit In della vettura #12, stint 1' })).toHaveValue('01:00:10.000');
    expect(screen.getByRole('table', { name: 'Penalità per vettura' })).toHaveTextContent('#1200:00:07.500');

    // In lettura niente X per svuotare le righe.
    expect(screen.queryByRole('button', { name: /Svuota la riga/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Modifica' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Cambio pilota' }), 'Da stint 2 a stint 3');
    expect(screen.getByRole('table', { name: 'Cambio 2: stint 2 → stint 3' })).toBeInTheDocument();
    const pitIn = screen.getByRole('textbox', { name: 'Pit In della vettura #7, stint 2' });
    await user.type(pitIn, '2.13.20,6');
    await user.tab();
    expect(pitIn).toHaveValue('02:13:20.600');
    await user.type(screen.getByRole('textbox', { name: 'Pit Out della vettura #7, stint 3' }), '1:0');
    await user.tab();
    expect(screen.getByRole('alert')).toHaveTextContent('1 tempo non valido');
    expect(within(screen.getByRole('combobox', { name: 'Cambio pilota' })).getByRole('option', { name: 'Da stint 2 a stint 3 (contiene errori)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    await user.clear(screen.getByRole('textbox', { name: 'Pit Out della vettura #7, stint 3' }));
    await user.type(screen.getByRole('textbox', { name: 'Note sulla vettura #7, cambio 2' }), 'Rientro anticipato');
    // La X a lato della riga ne svuota il contenuto; sulle righe vuote non c'è.
    const pitOut12 = screen.getByRole('textbox', { name: 'Pit Out della vettura #12, stint 3' });
    expect(screen.getByRole('button', { name: 'Svuota la riga della vettura #12, cambio 2' })).toBeDisabled();
    await user.type(pitOut12, '010000,5');
    await user.tab();
    expect(pitOut12).toHaveValue('01:00:00.500');
    await user.click(screen.getByRole('button', { name: 'Svuota la riga della vettura #12, cambio 2' }));
    expect(pitOut12).toHaveValue('');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Cambio pilota' }), 'Da stint 1 a stint 2');
    await user.click(screen.getByRole('checkbox', { name: 'Penalità annullata per la vettura #12, cambio 1' }));
    expect(screen.getByText('Nessuna penalità per cambio pilota.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    expect(updateRace).not.toHaveBeenCalled();
    expect(updateRaceDriverSwaps).toHaveBeenCalledWith(1, [
      { swap: 1, crewId: 1, pitInMs: 3_600_000, pitOutMs: 600_000, isCancelled: false, notes: '' },
      { swap: 1, crewId: 2, pitInMs: 3_610_000, pitOutMs: 605_000, isCancelled: true, notes: 'Box lento' },
      { swap: 2, crewId: 1, pitInMs: 8_000_600, pitOutMs: null, isCancelled: false, notes: 'Rientro anticipato' },
    ]);
  });
});
