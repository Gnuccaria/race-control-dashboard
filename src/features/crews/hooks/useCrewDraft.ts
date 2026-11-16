import { useState } from 'react';
import {
  type CrewChampionshipChoice,
  type CrewDraft,
  findCrewNameIssue,
  normalizeDiscordChannelId,
  parseCrewNumber,
  sanitizeCrewNumberInput,
  validateCrewDraft,
} from '@shared/crewRules';

/** Valori dei campi così come sono a schermo ('' = non scelto). */
export interface CrewDraftValues {
  readonly name: string;
  readonly numberText: string;
  /** Id dell'auto come testo (valore del menu); '' = non scelta. */
  readonly carId: string;
  readonly championship: CrewChampionshipChoice | '';
  /** Esadecimale "#RRGGBB"; '' = nessun colore. */
  readonly color: string;
  /** ID (o link) del canale Discord dell'equipaggio; '' = nessun canale. */
  readonly discordChannelId: string;
}

const EMPTY_VALUES: CrewDraftValues = { name: '', numberText: '', carId: '', championship: '', color: '', discordChannelId: '' };

const toDraftValues = (crew: CrewDraft): CrewDraftValues => ({
  name: crew.name,
  numberText: String(crew.number),
  carId: crew.carId === null ? '' : String(crew.carId),
  championship: crew.championship ?? '',
  color: crew.color ?? '',
  discordChannelId: crew.discordChannelId ?? '',
});

/**
 * Stato dei campi di un equipaggio, nuovo o esistente. Il numero viene ripulito a ogni battitura
 * (solo cifre, massimo tre), quindi nel campo non può comparire altro; la validità è derivata
 * durante il render. Spazi iniziali, finali o doppi non sono errori: li sistema validateCrewDraft.
 */
export function useCrewDraft(initialCrew?: CrewDraft) {
  const [values, setValues] = useState<CrewDraftValues>(() => (initialCrew ? toDraftValues(initialCrew) : EMPTY_VALUES));

  const nameIssue = findCrewNameIssue(values.name);
  // Il canale è facoltativo: vuoto va bene, altrimenti deve essere un ID o un link a un canale.
  const isChannelInvalid = values.discordChannelId.trim() !== '' && normalizeDiscordChannelId(values.discordChannelId) === null;
  // Tutti i campi sono obbligatori.
  const isComplete =
    nameIssue === null &&
    parseCrewNumber(values.numberText) !== null &&
    values.carId !== '' &&
    values.championship !== '' &&
    values.color !== '' &&
    !isChannelInvalid;

  return {
    values,
    changeName: (name: string) => {
      setValues((previousValues) => ({ ...previousValues, name }));
    },
    changeNumber: (typedValue: string) => {
      setValues((previousValues) => ({ ...previousValues, numberText: sanitizeCrewNumberInput(typedValue) }));
    },
    changeCar: (carId: string) => {
      setValues((previousValues) => ({ ...previousValues, carId }));
    },
    changeChampionship: (championship: CrewChampionshipChoice) => {
      setValues((previousValues) => ({ ...previousValues, championship }));
    },
    changeColor: (color: string) => {
      setValues((previousValues) => ({ ...previousValues, color }));
    },
    changeDiscordChannel: (discordChannelId: string) => {
      setValues((previousValues) => ({ ...previousValues, discordChannelId }));
    },
    /** Uscendo dal campo, un link al canale diventa il suo ID. */
    normalizeDiscordChannel: () => {
      setValues((previousValues) => ({
        ...previousValues,
        discordChannelId: normalizeDiscordChannelId(previousValues.discordChannelId) ?? previousValues.discordChannelId.trim(),
      }));
    },
    isChannelInvalid,
    /** I campi vuoti non mostrano errori: tengono solo disattivato il pulsante. */
    visibleNameIssue: nameIssue === 'required' ? null : nameIssue,
    isComplete,
    /** Stessa convalida del server, con i valori già in forma canonica. */
    validate: () =>
      validateCrewDraft({
        name: values.name,
        number: parseCrewNumber(values.numberText),
        carId: values.carId === '' ? '' : Number(values.carId),
        championship: values.championship,
        color: values.color,
        discordChannelId: values.discordChannelId,
      }),
  };
}

export type CrewDraftState = ReturnType<typeof useCrewDraft>;
