import { screen, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** Apre il campo Tracciato e sceglie nazione, tracciato e configurazione (più, se richiesto, "al contrario"). */
export async function chooseTrack(
  user: UserEvent,
  choice: { country: string; track: string; configuration?: string; isReversed?: boolean },
) {
  await user.click(screen.getByRole('button', { name: 'Tracciato' }));
  const dialog = await screen.findByRole('dialog', { name: 'Scegli il tracciato' });
  const countrySelect = within(dialog).getByRole('combobox', { name: 'Nazione' });
  // Le piste arrivano (finte) dal server: si aspetta che il menu abbia le opzioni.
  await within(countrySelect).findByRole('option', { name: choice.country });
  await user.selectOptions(countrySelect, choice.country);
  await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tracciato' }), choice.track);
  if (choice.configuration) {
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Configurazione' }), choice.configuration);
  }
  if (choice.isReversed) await user.click(within(dialog).getByRole('checkbox', { name: /Versione al contrario/ }));
  await user.click(within(dialog).getByRole('button', { name: 'Conferma' }));
}
