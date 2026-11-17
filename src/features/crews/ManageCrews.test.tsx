import type { SavedCrew } from '@shared/crewRules';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/renderWithRouter';
import { testCarId } from '@/test/testCars';
import { deleteCrews, fetchCrew, fetchCrews, updateCrew } from './services/crewApi';

vi.mock('@/features/auth/services/desktopBridge');
vi.mock('@/features/auth/services/discordApi');
vi.mock('./services/crewApi');

const LIST_PATH = '/campionato/gestisci-equipaggi';
const FIE = 'Cool1 FIE Championship';
const JAPAN = 'All Japan GT Championship';
const FIE_CAR = `Auto nel ${FIE}`;

const SAVED_CREWS: SavedCrew[] = [
  { id: 1, name: 'Sim Racing Café', number: 690, championships: [{ championship: FIE, carId: null }], color: '#00A3E0', createdAt: '2026-11-13T00:00:00Z' },
  { id: 2, name: 'GT Tribe Team Yellow', number: 20, championships: [{ championship: FIE, carId: testCarId('Porsche') }], color: '#FFB800', createdAt: '2026-11-13T00:00:00Z' },
  { id: 3, name: 'Alberto Ciola Racing', number: 67, championships: [{ championship: FIE, carId: testCarId('Audi') }], color: '#E10600', createdAt: '2026-11-13T00:00:00Z' },
];

/** Numeri degli equipaggi nell'ordine in cui compaiono nella tabella. */
const shownCrewNumbers = () =>
  within(screen.getByRole('table', { name: 'Equipaggi salvati' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

describe('Gestisci equipaggio: elenco', () => {
  beforeEach(() => {
    vi.mocked(fetchCrews).mockResolvedValue({ isSuccess: true, value: SAVED_CREWS });
  });

  it('mostra gli equipaggi per numero crescente e segnala i dati mancanti', async () => {
    renderApp(LIST_PATH);

    expect(await screen.findByRole('table', { name: 'Equipaggi salvati' })).toBeInTheDocument();
    expect(shownCrewNumbers()).toEqual(['20', '67', '690']);
    expect(screen.getByRole('columnheader', { name: /Numero/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByText('Dati mancanti: Auto')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Colore' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '#E10600' })).toBeInTheDocument();
    expect(screen.getByText('3 equipaggi')).toBeInTheDocument();
  });

  it('ordina A→Z al primo clic sulla testata e Z→A al secondo', async () => {
    const user = userEvent.setup();
    renderApp(LIST_PATH);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Nome' }));
    expect(screen.getByRole('columnheader', { name: /Nome/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(shownCrewNumbers()).toEqual(['67', '20', '690']);

    await user.click(screen.getByRole('button', { name: 'Nome' }));
    expect(screen.getByRole('columnheader', { name: /Nome/ })).toHaveAttribute('aria-sort', 'descending');
    expect(shownCrewNumbers()).toEqual(['690', '20', '67']);
  });

  it('filtra a ogni carattere digitato e per auto', async () => {
    const user = userEvent.setup();
    renderApp(LIST_PATH);
    await screen.findByRole('table');

    await user.type(screen.getByRole('textbox', { name: 'Cerca' }), '6');
    expect(shownCrewNumbers()).toEqual(['67', '690']);
    await user.type(screen.getByRole('textbox', { name: 'Cerca' }), '9');
    expect(shownCrewNumbers()).toEqual(['690']);

    await user.clear(screen.getByRole('textbox', { name: 'Cerca' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Auto' }), 'Audi');
    expect(shownCrewNumbers()).toEqual(['67']);
    expect(screen.getByText('1 di 3 equipaggi')).toBeInTheDocument();
  });

  it('il tasto destro seleziona e deseleziona; Elimina chiede conferma e ricarica l’elenco', async () => {
    vi.mocked(deleteCrews).mockResolvedValue({ isSuccess: true, value: 2 });
    const user = userEvent.setup();
    renderApp(LIST_PATH);
    await screen.findByRole('table');
    const rowOf = (crewName: string) => screen.getByText(crewName).closest('tr') as HTMLElement;

    expect(screen.queryByRole('button', { name: 'Elimina' })).not.toBeInTheDocument();
    await user.pointer({ keys: '[MouseRight]', target: rowOf('Sim Racing Café') });
    await user.pointer({ keys: '[MouseRight]', target: rowOf('Alberto Ciola Racing') });
    await user.pointer({ keys: '[MouseRight]', target: rowOf('GT Tribe Team Yellow') });
    await user.pointer({ keys: '[MouseRight]', target: rowOf('GT Tribe Team Yellow') });
    expect(screen.getByText('2 equipaggi selezionati')).toBeInTheDocument();

    // Dopo l'eliminazione il server restituisce l'elenco aggiornato.
    vi.mocked(fetchCrews).mockResolvedValue({ isSuccess: true, value: [SAVED_CREWS[1] as SavedCrew] });
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    const confirmDialog = screen.getByRole('dialog', { name: 'Eliminare 2 equipaggi?' });
    expect(confirmDialog).toHaveTextContent('Alberto Ciola Racing e Sim Racing Café');
    await user.click(within(confirmDialog).getByRole('button', { name: 'Elimina' }));

    expect(deleteCrews).toHaveBeenCalledWith([3, 1]);
    expect(await screen.findByText('2 equipaggi eliminati.')).toBeInTheDocument();
    expect(await screen.findByText('1 equipaggio')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Elimina' })).not.toBeInTheDocument();
  });

  it('mostra il motivo se il server non risponde e permette di riprovare', async () => {
    vi.mocked(fetchCrews).mockResolvedValueOnce({ isSuccess: false, errorKind: 'server-unreachable' });
    const user = userEvent.setup();
    renderApp(LIST_PATH);

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossibile contattare il server');
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});

describe('Gestisci equipaggio: dettaglio', () => {
  const crewWithoutCar = SAVED_CREWS[0] as SavedCrew;

  beforeEach(() => {
    vi.mocked(fetchCrews).mockResolvedValue({ isSuccess: true, value: SAVED_CREWS });
    vi.mocked(fetchCrew).mockResolvedValue({ isSuccess: true, value: crewWithoutCar });
    vi.mocked(updateCrew).mockReset();
  });

  it('si apre dalla freccia del record con i campi in sola lettura', async () => {
    const user = userEvent.setup();
    renderApp(LIST_PATH);

    await user.click(await screen.findByRole('link', { name: 'Apri i dettagli di Sim Racing Café' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Sim Racing Café' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome equipaggio' })).toHaveAttribute('readonly');
    expect(screen.getByRole('combobox', { name: FIE_CAR })).toBeDisabled();
    expect(fetchCrew).toHaveBeenCalledWith(1);
  });

  it('Modifica rende i campi modificabili e Salva invia i dati controllati', async () => {
    vi.mocked(updateCrew).mockResolvedValue({ isSuccess: true, value: { ...crewWithoutCar, championships: [{ championship: FIE, carId: testCarId('Nissan') }] } });
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/1`);

    await user.click(await screen.findByRole('button', { name: 'Modifica' }));
    // Senza auto il salvataggio non è possibile.
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: FIE_CAR }), 'Nissan');
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    expect(updateCrew).toHaveBeenCalledWith(1, {
      name: 'Sim Racing Café',
      number: 690,
      championships: [{ championship: FIE, carId: testCarId('Nissan') }],
      color: '#00A3E0',
      discordChannelId: null,
      discordRoleId: null,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Modifiche salvate.');
    expect(screen.getByRole('button', { name: 'Modifica' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: FIE_CAR })).toHaveDisplayValue('Nissan');
  });

  it('in modifica il colore si cambia con lo stesso popup della creazione', async () => {
    vi.mocked(updateCrew).mockImplementation((_crewId, crew) =>
      Promise.resolve({ isSuccess: true, value: { ...crewWithoutCar, ...crew } }),
    );
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/1`);

    const colorButton = await screen.findByRole('button', { name: /Colore #00A3E0/ });
    expect(colorButton).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Modifica' }));
    await user.selectOptions(screen.getByRole('combobox', { name: FIE_CAR }), 'Audi');
    await user.click(screen.getByRole('button', { name: /Colore #00A3E0/ }));

    const pickerDialog = screen.getByRole('dialog', { name: 'Scegli il colore' });
    const hexInput = within(pickerDialog).getByRole('textbox', { name: 'Esadecimale' });
    await user.clear(hexInput);
    await user.type(hexInput, '2e7d32');
    expect(within(pickerDialog).getByRole('spinbutton', { name: 'Tonalità (H)' })).toHaveValue(123);
    await user.click(within(pickerDialog).getByRole('button', { name: 'Conferma' }));

    await user.click(screen.getByRole('button', { name: 'Salva' }));
    expect(updateCrew).toHaveBeenCalledWith(1, expect.objectContaining({ color: '#2E7D32' }));
    expect(await screen.findByRole('button', { name: /Colore #2E7D32/ })).toBeInTheDocument();
  });

  it('un equipaggio importato senza colore si salva solo dopo averlo completato; i campionati si aggiungono e tolgono', async () => {
    vi.mocked(fetchCrew).mockResolvedValue({
      isSuccess: true,
      value: { ...crewWithoutCar, championships: [], color: null },
    });
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/1`);

    await user.click(await screen.findByRole('button', { name: 'Modifica' }));
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    // Un campionato aggiunto vuole la sua auto, scelta tra quelle di quel campionato; la X lo toglie.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Aggiungi un campionato' }), JAPAN);
    const japanCar = screen.getByRole('combobox', { name: `Auto nel ${JAPAN}` });
    expect(within(japanCar).getAllByRole('option').map((option) => option.textContent)).toEqual(['Seleziona un\'auto', 'Nissan']);
    await user.click(screen.getByRole('button', { name: `Togli ${JAPAN}` }));
    expect(screen.queryByRole('combobox', { name: `Auto nel ${JAPAN}` })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Aggiungi un campionato' }), FIE);
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: FIE_CAR }), 'Audi');
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Scegli il colore' }));
    const pickerDialog = screen.getByRole('dialog', { name: 'Scegli il colore' });
    await user.type(within(pickerDialog).getByRole('textbox', { name: 'Esadecimale' }), '#0055A4');
    await user.click(within(pickerDialog).getByRole('button', { name: 'Conferma' }));
    expect(screen.getByRole('button', { name: 'Salva' })).toBeEnabled();
  });

  it('mostra l’errore del server e resta in modifica', async () => {
    vi.mocked(updateCrew).mockResolvedValue({ isSuccess: false, errorKind: 'duplicate-number' });
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/1`);

    await user.click(await screen.findByRole('button', { name: 'Modifica' }));
    await user.selectOptions(screen.getByRole('combobox', { name: FIE_CAR }), 'Audi');
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Esiste già un equipaggio con questo numero.');
    expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument();
  });

  it('Annulla chiede conferma e, confermando, torna ai dati salvati in sola lettura', async () => {
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/1`);

    await user.click(await screen.findByRole('button', { name: 'Modifica' }));
    await user.type(screen.getByRole('textbox', { name: 'Nome equipaggio' }), ' Bis');
    await user.click(screen.getByRole('button', { name: 'Annulla' }));

    const discardDialog = screen.getByRole('dialog', { name: 'Annullare le modifiche?' });
    await user.click(within(discardDialog).getByRole('button', { name: 'Continua a modificare' }));
    expect(screen.getByRole('textbox', { name: 'Nome equipaggio' })).toHaveValue('Sim Racing Café Bis');

    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Annullare le modifiche?' })).getByRole('button', { name: 'Annulla modifiche' }));
    expect(screen.getByRole('textbox', { name: 'Nome equipaggio' })).toHaveValue('Sim Racing Café');
    expect(screen.getByRole('textbox', { name: 'Nome equipaggio' })).toHaveAttribute('readonly');
    expect(updateCrew).not.toHaveBeenCalled();
  });

  it('uscendo durante la modifica chiede conferma; confermando le modifiche si perdono', async () => {
    const user = userEvent.setup();
    renderApp(`${LIST_PATH}/1`);

    await user.click(await screen.findByRole('button', { name: 'Modifica' }));
    await user.type(screen.getByRole('textbox', { name: 'Nome equipaggio' }), ' Bis');

    await user.click(screen.getByRole('link', { name: 'Tutti gli equipaggi' }));
    const leaveDialog = screen.getByRole('dialog', { name: 'Uscire senza salvare?' });
    await user.click(within(leaveDialog).getByRole('button', { name: 'Continua a modificare' }));
    expect(screen.getByRole('textbox', { name: 'Nome equipaggio' })).toHaveValue('Sim Racing Café Bis');

    await user.click(screen.getByRole('link', { name: 'Tutti gli equipaggi' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Uscire senza salvare?' })).getByRole('button', { name: 'Esci senza salvare' }),
    );
    expect(await screen.findByRole('table', { name: 'Equipaggi salvati' })).toBeInTheDocument();
    expect(updateCrew).not.toHaveBeenCalled();
  });
});
