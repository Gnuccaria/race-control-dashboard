/** Nomi dei campi del form "Aggiungi equipaggio", usati sia negli input sia nella lettura del FormData. */
export const CREW_FORM_FIELDS = {
  name: 'crewName',
  number: 'crewNumber',
  /** Campo nascosto con i campionati e le loro auto, in JSON. */
  championships: 'crewChampionships',
  color: 'crewColor',
  discordChannelId: 'crewDiscordChannelId',
  discordRoleId: 'crewDiscordRoleId',
} as const;
