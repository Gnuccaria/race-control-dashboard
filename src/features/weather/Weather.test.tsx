import type { SavedRace } from '@shared/raceRules';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRace, fetchRaces } from '@/features/race-results/services/raceApi';
import { renderApp } from '@/test/renderWithRouter';
import { fetchRaceWeather, saveRaceWeather } from './services/weatherApi';

vi.mock('@/features/auth/services/desktopBridge');
vi.mock('@/features/auth/services/discordApi');
vi.mock('@/features/race-results/services/raceApi');
vi.mock('./services/weatherApi');

const race: SavedRace = {
  id: 1,
  name: '6 Ore di Monza',
  championship: 'Cool1 FIE Championship',
  duration: 6,
  totalLaps: null,
  round: 3,
  trackId: null,
  trackName: null,
  trackConfiguration: null,
  isTrackReversed: false,
  raceDate: '2099-01-10',
  startTime: '21:00',
  endDate: '2099-01-11',
  endTime: '03:00',
  updatedAt: '2026-11-18T10:00:00Z',
  results: [],
  driverSwaps: [],
};

describe('Crea pattern meteo', () => {
  beforeEach(() => {
    vi.mocked(fetchRaces).mockResolvedValue({ isSuccess: true, value: [race] });
    vi.mocked(fetchRace).mockResolvedValue({ isSuccess: true, value: race });
    vi.mocked(fetchRaceWeather).mockResolvedValue({ isSuccess: true, value: { stintCount: 2, pattern: null } });
  });

  it('elenca le gare (anche future) e apre il dettaglio con la qualifica e una riga per stint', async () => {
    const user = userEvent.setup();
    renderApp('/pre-gara/pattern-meteo');
    await user.click(await screen.findByRole('link', { name: /6 Ore di Monza/ }));
    const grid = await screen.findByRole('table', { name: 'Pattern meteo' });
    expect(within(grid).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['Qualifica', 'Stint 1', 'Stint 2']);
    // 2 slot di qualifica + 9 per stint, in sola lettura finché non si preme Modifica.
    expect(within(grid).getAllByRole('combobox')).toHaveLength(2 + 9 * 2);
    expect(screen.getByRole('combobox', { name: 'Qualifica, slot 1' })).toBeDisabled();
  });

  it('ogni slot va compilato (S01–R08) prima di salvare; il valore scelto mostra la sua icona', async () => {
    vi.mocked(saveRaceWeather).mockImplementation((_raceId, pattern) => Promise.resolve({ isSuccess: true, value: { stintCount: 2, pattern } }));
    const user = userEvent.setup();
    renderApp('/pre-gara/pattern-meteo/1');
    await user.click(await screen.findByRole('button', { name: 'Modifica' }));
    const firstSlot = screen.getByRole('combobox', { name: 'Qualifica, slot 1' });
    expect(within(firstSlot).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '--',
      ...['S', 'C', 'R'].flatMap((prefix) => Array.from({ length: { S: 13, C: 6, R: 8 }[prefix] ?? 0 }, (_unused, index) => `${prefix}${String(index + 1).padStart(2, '0')}`)),
    ]);
    await user.selectOptions(firstSlot, 'R06');
    expect(screen.getByRole('img', { name: 'Pioggia pesante' })).toBeInTheDocument();
    expect(screen.getByText('Mancano 19 slot da compilare.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Qualifica, slot 2' }), 'S09');
    for (const stint of [1, 2]) {
      for (let slot = 1; slot <= 9; slot += 1) await user.selectOptions(screen.getByRole('combobox', { name: `Stint ${stint}, slot ${slot}` }), stint === 1 ? 'C02' : 'C05');
    }
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByText('Modifiche salvate.')).toBeInTheDocument();
    expect(saveRaceWeather).toHaveBeenCalledWith(1, { qualifying: ['R06', 'S09'], stints: [Array(9).fill('C02'), Array(9).fill('C05')] });
  }, 20_000);
});
