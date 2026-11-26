import type { LegacyTrackMatch, TrackMapMatch, TrackRefreshPreview } from '@shared/trackRules';
import { ManualMatchSection, SourceRefreshPanel } from '@/components/source-refresh/SourceRefreshPanel';
import { useSourceRefresh } from '@/hooks/useSourceRefresh';
import { useI18n } from '@/i18n/useI18n';
import { refreshTracks } from '../trackApi';

interface Choices {
  readonly mapMatches: readonly TrackMapMatch[];
  readonly legacyMatches: readonly LegacyTrackMatch[];
}

const sameChoices = (first: Choices, second: Choices) =>
  JSON.stringify([first.mapMatches, first.legacyMatches]) === JSON.stringify([second.mapMatches, second.legacyMatches]);

/**
 * Aggiornamento manuale dei tracciati: "Aggiorna dati" chiede al server di leggere il wiki di Gran Turismo e le mappe di
 * gt-engine.com e mostra l'anteprima. I vecchi tracciati usati da gare senza corrispondenza e le configurazioni senza
 * mappa si abbinano a mano (o "nessuna") e l'anteprima si ricalcola; "Invia al server" salva, dopo una conferma.
 */
export function TrackRefreshPanel({ onSaved }: { readonly onSaved: () => void }) {
  const { messages } = useI18n();
  const texts = messages.manageTracks.refresh;
  const refresh = useSourceRefresh<Choices, TrackRefreshPreview>({
    refresh: (choices, mode) => refreshTracks({ ...choices, ...mode }),
    initialChoices: { mapMatches: [], legacyMatches: [] },
    sameChoices,
    onSaved,
  });
  const { choices, setChoices } = refresh;

  return (
    <SourceRefreshPanel
      refresh={refresh}
      texts={texts}
      previewTitle={() => texts.previewTitle}
      totalLine={(preview) => texts.trackCount(preview.trackCount)}
      fieldLabel={(field) => texts.fields[field]}
      matchSections={(preview) => (
        <>
          <ManualMatchSection
            title={texts.legacyTitle}
            hint={texts.legacyHint}
            placeholderLabel={texts.chooseLayout}
            noneLabel={texts.noLayout}
            items={preview.unmatchedLegacy.map((track) => ({
              key: String(track.trackId),
              label: track.name,
              note: texts.legacyUsage(track.usageCount),
              selectLabel: texts.legacyFor(track.name),
              chosen: choices.legacyMatches.find((match) => match.trackId === track.trackId)?.sourceKey,
              options: preview.layouts.map((layout) => ({ value: layout.sourceKey, label: layout.name })),
            }))}
            onChoose={(key, sourceKey) => {
              const trackId = Number(key);
              setChoices((previous) => {
                const others = previous.legacyMatches.filter((match) => match.trackId !== trackId);
                return { ...previous, legacyMatches: sourceKey === undefined ? others : [...others, { trackId, sourceKey }] };
              });
            }}
          />
          <ManualMatchSection
            title={texts.mapsTitle}
            hint={texts.mapsHint}
            placeholderLabel={texts.chooseMap}
            noneLabel={texts.noMap}
            items={preview.layoutsWithoutMap.map((layout) => ({
              key: layout.sourceKey,
              label: layout.name,
              selectLabel: texts.mapFor(layout.name),
              chosen: choices.mapMatches.find((match) => match.sourceKey === layout.sourceKey)?.mapFile,
              options: preview.unmatchedMaps.map((map) => ({ value: map.file, label: map.label })),
            }))}
            onChoose={(sourceKey, mapFile) => {
              setChoices((previous) => {
                const others = previous.mapMatches.filter((match) => match.sourceKey !== sourceKey);
                return { ...previous, mapMatches: mapFile === undefined ? others : [...others, { sourceKey, mapFile }] };
              });
            }}
          />
        </>
      )}
    />
  );
}
