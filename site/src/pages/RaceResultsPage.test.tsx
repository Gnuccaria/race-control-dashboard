import '@testing-library/jest-dom/vitest';
import type { PublicRace } from '@shared/raceRules';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPublicRace } from '../api/publicRaces';
import { Component, loader } from './RaceResultsPage';

vi.mock('../api/publicRaces', () => ({
  fetchPublicRace: vi.fn(),
  publicRaceReportUrl: (raceId: number, locale: string) => `https://api.test/public/races/${raceId}/report.pdf?lang=${locale}`,
}));

const race: PublicRace = {
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
  raceDate: '2026-11-08',
  startTime: '21:00',
  endDate: '2026-11-09',
  endTime: '03:00',
  updatedAt: '2026-11-09T10:00:00Z',
  results: [{ position: 1, laps: 120, crewNumber: 16, crewName: 'Vez Team Lime', crewColor: '#00FF00', carName: 'Audi R8', gapMs: null, penaltyMs: 23_000 }],
  weather: { stintCount: 2, pattern: { qualifying: ['S01', 'S09'], stints: [Array(9).fill('C02'), Array(9).fill('R07')] } },
};

const renderRacePage = async () => {
  const router = createMemoryRouter([{ path: '/gare/:raceId', loader, Component }], { initialEntries: ['/gare/1'] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: '6 Ore di Monza' });
};

describe('pagina della gara sul sito', () => {
  beforeEach(() => {
    vi.mocked(fetchPublicRace).mockResolvedValue(race);
    Object.defineProperty(navigator, 'pdfViewerEnabled', { value: true, configurable: true });
  });

  it('quattro schede: Qualifiche non ancora disponibile, Gara (la classifica, scheda iniziale), Meteo e Documentazione', async () => {
    await renderRacePage();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Qualifiche', 'Gara', 'Meteo', 'Documentazione']);
    expect(screen.getByRole('tab', { name: 'Qualifiche' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Gara' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('table', { name: 'Classifica della gara' })).toHaveTextContent('+23,000');
    // Il referto non sta più sopra la classifica.
    expect(screen.queryByRole('button', { name: 'Visualizza referto' })).not.toBeInTheDocument();
  });

  it('Meteo: la qualifica con 2 slot e una riga per stint con 9 slot, ognuno con icona e codice', async () => {
    const user = userEvent.setup();
    await renderRacePage();
    await user.click(screen.getByRole('tab', { name: 'Meteo' }));
    const grid = screen.getByRole('table', { name: 'Pattern meteo' });
    expect(within(grid).getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['Qualifica', 'Stint 1', 'Stint 2']);
    expect(within(grid).getByRole('group', { name: 'Qualifica, slot 2: S09, Sole con leggera nebbia' })).toHaveTextContent('S09');
    expect(within(grid).getAllByRole('img', { name: 'Pioggia pesante' })).toHaveLength(9);
    expect(within(grid).getAllByRole('img', { name: 'Nuvole leggere' })).toHaveLength(9);
  });

  it('Documentazione: briefing e referto di qualifica non disponibili, il referto di gara si visualizza e si scarica', async () => {
    const user = userEvent.setup();
    await renderRacePage();
    await user.click(screen.getByRole('tab', { name: 'Documentazione' }));
    const table = screen.getByRole('table', { name: 'Documentazione della gara' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'Briefing pre-garaNon ancora disponibile',
      'Referto di qualificaNon ancora disponibile',
      'Referto di gara',
    ]);
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: 'Visualizza' })).toBeDisabled();
    expect(within(rows[0] as HTMLElement).getByRole('button', { name: 'Scarica Briefing pre-gara (PDF)' })).toBeDisabled();
    expect(within(rows[2] as HTMLElement).getByRole('link', { name: 'Scarica Referto di gara (PDF)' })).toHaveAttribute('href', 'https://api.test/public/races/1/report.pdf?lang=it');

    await user.click(within(rows[2] as HTMLElement).getByRole('button', { name: 'Visualizza' }));
    expect(within(rows[2] as HTMLElement).getByRole('button', { name: 'Chiudi' })).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('object')).toHaveAttribute('data', 'https://api.test/public/races/1/report.pdf?lang=it#view=FitH');
  });
});
