import type { TrackRefreshPreview } from '@shared/trackRules';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '@/test/renderWithRouter';
import { TEST_TRACKS } from '@/test/testTracks';
import { fetchTracks, refreshTracks } from './trackApi';

vi.mock('@/features/auth/services/desktopBridge');
vi.mock('@/features/auth/services/discordApi');

const PREVIEW: TrackRefreshPreview = {
  trackCount: 85,
  inserted: ['Tsukuba Circuit - Full Course'],
  updated: [{ name: 'Monza - Full Course → Autodromo Nazionale Monza - Full Course', changes: [{ field: 'mapFile', before: null, after: 'monza.png' }] }],
  deleted: ['Vallelunga'],
  kept: ['Imola - Full Course'],
  unmatchedLegacy: [{ trackId: 7, name: 'Imola - Full Course', usageCount: 2 }],
  layouts: [
    { sourceKey: 'autodromo nazionale monza|full course', name: 'Autodromo Nazionale Monza - Full Course' },
    { sourceKey: 'sugo international racing course|full course', name: 'SUGO International Racing Course - Full Course' },
  ],
  layoutsWithoutMap: [{ sourceKey: 'sugo international racing course|full course', name: 'SUGO International Racing Course - Full Course' }],
  unmatchedMaps: [{ file: 'northern-isle-infield.png', label: 'Northern Isle Infield' }],
};

describe('Gestisci tracciati', () => {
  beforeEach(() => {
    vi.mocked(fetchTracks).mockResolvedValue({ isSuccess: true, value: TEST_TRACKS });
    vi.mocked(refreshTracks).mockReset();
  });

  it('mostra i tracciati con nazione, lunghezza in km e miglia, senso inverso e mappa; filtri Nazione → Tracciato → Configurazione', async () => {
    const user = userEvent.setup();
    renderApp('/campionati/tracciati');
    const table = await screen.findByRole('table', { name: 'Tracciati' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Nazione', 'Tracciato', 'Configurazione', 'Lunghezza', 'Reversibile', 'Mappa']);
    const firstRow = within(table).getAllByRole('row')[1] as HTMLElement;
    expect(within(firstRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Francia', 'Alsace', 'Villaggio', '5,423 km (3,37 mi)', 'Sì', 'Apri la mappa']);
    expect(within(firstRow).getByRole('link', { name: 'Mappa di Alsace – Villaggio (si apre gt-engine.com)' })).toHaveAttribute('href', 'https://gt-engine.com/gt7/tracks/images/md/alsace-village.png');
    expect(screen.getByText(/Le mappe non sono nostre/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'gt-engine.com' })).toHaveAttribute('href', 'https://gt-engine.com/gt7/tracks/track-maps.html');

    // Il tracciato si sceglie dopo la nazione, la configurazione dopo il tracciato.
    expect(screen.getByRole('combobox', { name: 'Tracciato' })).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nazione' }), 'Giappone');
    expect(screen.getByText('3 di 6 configurazioni')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tracciato' }), 'Suzuka Circuit');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Configurazione' }), 'Tracciato est');
    expect(screen.getByText('1 di 6 configurazioni')).toBeInTheDocument();
    // Cambiando nazione si azzerano tracciato e configurazione.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nazione' }), 'Italia');
    expect(screen.getByRole('combobox', { name: 'Tracciato' })).toHaveValue('');
    expect(screen.getByText('2 di 6 configurazioni')).toBeInTheDocument();
  });

  it("Aggiorna dati: anteprima, abbinamenti a mano (vecchi tracciati e mappe), ricalcolo e invio dopo la conferma", async () => {
    vi.mocked(refreshTracks).mockImplementation(({ apply }) => Promise.resolve({ isSuccess: true, value: { preview: PREVIEW, ...(apply && { tracks: TEST_TRACKS }) } }));
    const user = userEvent.setup();
    renderApp('/campionati/tracciati');
    await user.click(await screen.findByRole('button', { name: 'Aggiorna dati' }));
    expect(refreshTracks).toHaveBeenLastCalledWith({ apply: false, refetch: true, mapMatches: [], legacyMatches: [] });

    expect(await screen.findByText('85 configurazioni in tutto')).toBeInTheDocument();
    expect(screen.getByText('Non più nel wiki ma usati da gare, restano: Imola - Full Course')).toBeInTheDocument();
    expect(screen.getByText('Imola - Full Course')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Configurazione del wiki per Imola - Full Course' }), 'Nessuna (gare senza tracciato)');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Mappa di gt-engine per SUGO International Racing Course - Full Course' }), 'Northern Isle Infield');
    // Con scelte nuove si ricalcola prima di poter inviare.
    expect(screen.getByRole('button', { name: 'Invia al server' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: "Ricalcola l'anteprima" }));
    const choices = {
      mapMatches: [{ sourceKey: 'sugo international racing course|full course', mapFile: 'northern-isle-infield.png' }],
      legacyMatches: [{ trackId: 7, sourceKey: null }],
    };
    expect(refreshTracks).toHaveBeenLastCalledWith({ apply: false, refetch: false, ...choices });

    await user.click(await screen.findByRole('button', { name: 'Invia al server' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Invia al server' }));
    expect(refreshTracks).toHaveBeenLastCalledWith({ apply: true, refetch: false, ...choices });
    expect(await screen.findByText('Tracciati aggiornati: 1 nuovi, 1 cambiati, 1 eliminati.')).toBeInTheDocument();
  });

  it("spiega quando un sito dei tracciati non risponde", async () => {
    vi.mocked(refreshTracks).mockResolvedValue({ isSuccess: false, errorKind: 'track-source-unreachable' });
    const user = userEvent.setup();
    renderApp('/campionati/tracciati');
    await user.click(await screen.findByRole('button', { name: 'Aggiorna dati' }));
    expect(await screen.findByText('Uno dei siti dei tracciati non risponde: riprova tra poco.')).toBeInTheDocument();
  });
});
