import type { CarRefreshPreview, CarSourceMatch } from '@shared/carRules';
import { ManualMatchSection, SourceRefreshPanel } from '@/components/source-refresh/SourceRefreshPanel';
import { useSourceRefresh } from '@/hooks/useSourceRefresh';
import { useI18n } from '@/i18n/useI18n';
import { refreshCars } from '../carApi';

interface CarRefreshPanelProps {
  /** Dopo il salvataggio: la pagina rilegge le vetture. */
  readonly onSaved: () => void;
}

const sameMatches = (first: readonly CarSourceMatch[], second: readonly CarSourceMatch[]) =>
  first.length === second.length && first.every((match) => second.some((other) => other.officialId === match.officialId && other.bopKey === match.bopKey));

/**
 * Aggiornamento manuale delle vetture: "Aggiorna dati" chiede al server di scaricare il catalogo ufficiale di GT7 e il
 * BoP Midspeed di gt-engine.com e mostra l'anteprima (nuove, aggiornate, eliminate, che restano). Le auto senza BoP
 * trovato si abbinano a mano (o "nessuna") e l'anteprima si ricalcola; "Invia al server" salva, dopo una conferma.
 */
export function CarRefreshPanel({ onSaved }: CarRefreshPanelProps) {
  const { messages } = useI18n();
  const texts = messages.cars.refresh;
  const refresh = useSourceRefresh<readonly CarSourceMatch[], CarRefreshPreview>({
    refresh: (matches, { apply, refetch }) => refreshCars(matches, apply, refetch),
    initialChoices: [],
    sameChoices: sameMatches,
    onSaved,
  });

  return (
    <SourceRefreshPanel
      refresh={refresh}
      texts={texts}
      previewTitle={(preview) => (preview.bopVersion ? texts.previewTitleWithVersion(preview.bopVersion) : texts.previewTitle)}
      totalLine={(preview) => texts.carCount(preview.cars.length)}
      fieldLabel={(field) => messages.cars.manage.columns[field]}
      matchSections={(preview) => (
        <ManualMatchSection
          title={texts.unmatchedTitle}
          hint={texts.unmatchedHint}
          placeholderLabel={texts.chooseBopCar}
          noneLabel={texts.noBopCar}
          items={preview.unmatchedOfficial.map((car) => ({
            key: car.officialId,
            label: car.name,
            note: car.group,
            selectLabel: texts.matchFor(car.name),
            chosen: refresh.choices.find((match) => match.officialId === car.officialId)?.bopKey,
            options: preview.unmatchedBop.filter((candidate) => candidate.group === car.group).map((option) => ({ value: option.key, label: option.name })),
          }))}
          onChoose={(officialId, bopKey) => {
            refresh.setChoices((previous) => {
              const others = previous.filter((match) => match.officialId !== officialId);
              return bopKey === undefined ? others : [...others, { officialId, bopKey }];
            });
          }}
        />
      )}
    />
  );
}
