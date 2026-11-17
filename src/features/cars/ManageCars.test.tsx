import type { Car, CarRefreshPreview } from '@shared/carRules';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/renderWithRouter';
import { fetchCars, refreshCars } from './carApi';

vi.mock('@/features/auth/services/desktopBridge');
vi.mock('@/features/auth/services/discordApi');

const car = (id: number, manufacturer: string, model: string, details: Partial<Car> = {}): Car => ({
  id,
  manufacturer,
  model,
  group: 'Gr.3',
  horsepower: 536,
  weightKg: 1220,
  drivetrain: 'MR',
  bopHorsepower: 461,
  bopWeightKg: 1230,
  limiter: 86,
  ballastKg: 10,
  championships: [],
  ...details,
});

const SAVED_CARS: Car[] = [
  car(1, 'Alfa Romeo', '4C Gr.3'),
  car(2, 'Porsche', "919 Hybrid '16", { group: 'Gr.1', horsepower: 507, weightKg: 875, bopHorsepower: 507, bopWeightKg: 975, limiter: 100, ballastKg: 100 }),
  car(3, 'BMW', "M3 GT '11", { horsepower: 508, weightKg: 1245, drivetrain: 'FR', bopHorsepower: null, bopWeightKg: null, limiter: null, ballastKg: null }),
];

const PREVIEW: CarRefreshPreview = {
  bopVersion: '1.72',
  cars: [],
  inserted: ["Mercedes-AMG GT3 '20"],
  updated: [{ name: 'Alfa Romeo 4C Gr.3', changes: [{ field: 'bopWeightKg', before: 1220, after: 1230 }] }],
  deleted: ['Lamborghini'],
  kept: ['Ferrari'],
  unmatchedOfficial: [{ officialId: 'car3', group: 'Gr.3', name: "BMW M3 GT '11" }],
  unmatchedBop: [
    { key: "Gr.3|BMW|M3 GT3 '11", group: 'Gr.3', name: "BMW M3 GT3 '11" },
    { key: 'Gr.4|Audi|TT Cup Gr.4', group: 'Gr.4', name: 'Audi TT Cup Gr.4' },
  ],
};

describe('Gestisci vetture', () => {
  beforeEach(() => {
    vi.mocked(fetchCars).mockResolvedValue({ isSuccess: true, value: SAVED_CARS });
    vi.mocked(refreshCars).mockReset();
  });

  it('mostra le vetture per gruppo con limitatore e zavorra, e filtra per gruppo e nome', async () => {
    const user = userEvent.setup();
    renderApp('/campionati/vetture');
    const table = await screen.findByRole('table', { name: 'Vetture' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Costruttore',
      'Modello',
      'Gruppo',
      'Potenza (CV)',
      'Peso (kg)',
      'Trasmissione',
      'Potenza BoP Midspeed (CV)',
      'Peso BoP Midspeed (kg)',
      '% Limitatore',
      'Zavorra',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual(['Porsche', 'Alfa Romeo', 'BMW']);
    expect(within(rows[1] as HTMLElement).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Alfa Romeo', '4C Gr.3', 'Gr.3', '536', '1220', 'MR', '461', '1230', '86%', '+10 kg']);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Gruppo' }), 'Gr.1');
    expect(screen.getByText('1 di 3 vetture')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Gruppo' }), '');
    await user.type(screen.getByRole('textbox', { name: 'Cerca' }), 'bmw');
    expect(within(screen.getByRole('table', { name: 'Vetture' })).getAllByRole('row')).toHaveLength(2);
  });

  it("Aggiorna dati mostra l'anteprima; un abbinamento a mano ricalcola l'anteprima; Invia al server salva dopo la conferma", async () => {
    vi.mocked(refreshCars).mockImplementation((matches, apply) =>
      Promise.resolve({ isSuccess: true, value: { preview: matches.length > 0 ? { ...PREVIEW, unmatchedOfficial: [] } : PREVIEW, ...(apply && { cars: SAVED_CARS }) } }),
    );
    const user = userEvent.setup();
    renderApp('/campionati/vetture');
    await user.click(await screen.findByRole('button', { name: 'Aggiorna dati' }));

    expect(await screen.findByText("Anteprima dell'aggiornamento (BoP versione 1.72)")).toBeInTheDocument();
    expect(screen.getByText('1 vettura nuova')).toBeInTheDocument();
    expect(screen.getByText('Non più nei siti ma usate da equipaggi o gare, restano: Ferrari')).toBeInTheDocument();
    expect(refreshCars).toHaveBeenLastCalledWith([], false);

    // Nel menu solo le vetture di gt-engine dello stesso gruppo, più "Nessuna".
    const matchSelect = screen.getByRole('combobox', { name: "Vettura di gt-engine per BMW M3 GT '11" });
    expect(within(matchSelect).getAllByRole('option').map((option) => option.textContent)).toEqual(['Scegli la vettura di gt-engine', 'Nessuna (senza BoP)', "BMW M3 GT3 '11"]);
    await user.selectOptions(matchSelect, "BMW M3 GT3 '11");
    // Con una scelta nuova si ricalcola prima di poter inviare.
    expect(screen.getByRole('button', { name: 'Invia al server' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: "Ricalcola l'anteprima" }));
    expect(refreshCars).toHaveBeenLastCalledWith([{ officialId: 'car3', bopKey: "Gr.3|BMW|M3 GT3 '11" }], false);

    await user.click(await screen.findByRole('button', { name: 'Invia al server' }));
    const dialog = screen.getByRole('dialog', { name: "Inviare l'aggiornamento al server?" });
    await user.click(within(dialog).getByRole('button', { name: 'Invia al server' }));
    expect(await screen.findByText('Vetture aggiornate: 1 nuove, 1 cambiate, 1 eliminate.')).toBeInTheDocument();
    expect(refreshCars).toHaveBeenLastCalledWith([{ officialId: 'car3', bopKey: "Gr.3|BMW|M3 GT3 '11" }], true);
  });

  it('se un sito non risponde lo dice', async () => {
    vi.mocked(refreshCars).mockResolvedValue({ isSuccess: false, errorKind: 'car-source-unreachable' });
    const user = userEvent.setup();
    renderApp('/campionati/vetture');
    await user.click(await screen.findByRole('button', { name: 'Aggiorna dati' }));
    expect(await screen.findByText('Uno dei siti delle vetture non risponde: riprova tra poco.')).toBeInTheDocument();
  });
});
