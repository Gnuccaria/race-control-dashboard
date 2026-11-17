import { useState } from 'react';
import { InlineAlert } from '@/components/feedback/InlineAlert/InlineAlert';
import { Switch } from '@/components/ui/Switch/Switch';
import { useI18n } from '@/i18n/useI18n';
import type { ServerErrorKind } from '@/services/serverApi';
import { saveRaceProtestSetting } from '../../services/raceApi';

interface RaceProtestSwitchProps {
  readonly raceId: number;
  readonly acceptsProtests: boolean;
  readonly onSaved: (acceptsProtests: boolean) => void;
}

/**
 * Interruttore "Accetta proteste" nel dettaglio della gara: acceso, la gara compare nel menu "Gara" di "Invia protesta"
 * sul sito (per gli equipaggi del suo campionato); spento, no. Si salva subito, senza "Modifica"; se non riesce,
 * torna com'era e lo dice.
 */
export function RaceProtestSwitch({ raceId, acceptsProtests, onSaved }: RaceProtestSwitchProps) {
  const { messages } = useI18n();
  const texts = messages.races.detail.protests;
  const [isSaving, setIsSaving] = useState(false);
  const [errorKind, setErrorKind] = useState<ServerErrorKind | null>(null);

  const change = async (nextValue: boolean) => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorKind(null);
    const result = await saveRaceProtestSetting(raceId, nextValue);
    setIsSaving(false);
    if (result.isSuccess) onSaved(result.value);
    else setErrorKind(result.errorKind);
  };

  return (
    <div>
      <Switch
        label={texts.label}
        description={acceptsProtests ? texts.onDescription : texts.offDescription}
        isChecked={acceptsProtests}
        onCheckedChange={(nextValue) => void change(nextValue)}
      />
      {errorKind && <InlineAlert>{messages.serverErrors[errorKind]}</InlineAlert>}
    </div>
  );
}
