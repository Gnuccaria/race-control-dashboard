import { useState } from 'react';
import {
  CREW_CHAMPIONSHIPS,
  type CrewChampionship,
  type CrewDraft,
  findCrewNameIssue,
  normalizeDiscordChannelId,
  normalizeDiscordRoleId,
  parseCrewNumber,
  sanitizeCrewNumberInput,
  validateCrewDraft,
} from '@shared/crewRules';

/** Valori dei campi così come sono a schermo ('' = non scelto). */
export interface CrewDraftValues {
  readonly name: string;
  readonly numberText: string;
  /** Campionati dell'equipaggio (anche nessuno), ognuno con l'id della sua auto come testo ('' = non scelta). */
  readonly championships: readonly CrewChampionshipValues[];
  /** Esadecimale "#RRGGBB"; '' = nessun colore. */
  readonly color: string;
  /** ID (o link) del canale Discord dell'equipaggio; '' = nessun canale. */
  readonly discordChannelId: string;
  /** ID (o menzione) del ruolo Discord dell'equipaggio; '' = nessun ruolo collegato. */
  readonly discordRoleId: string;
}

export interface CrewChampionshipValues {
  readonly championship: CrewChampionship;
  readonly carId: string;
}

const EMPTY_VALUES: CrewDraftValues = { name: '', numberText: '', championships: [], color: '', discordChannelId: '', discordRoleId: '' };

/** Campionati come li vuole il server: l'id dell'auto come numero ('' = mancante). */
export const toCrewChampionships = (championships: readonly CrewChampionshipValues[]) =>
  championships.map(({ championship, carId }) => ({ championship, carId: carId === '' ? '' : Number(carId) }));

const toDraftValues = (crew: CrewDraft): CrewDraftValues => ({
  name: crew.name,
  numberText: String(crew.number),
  championships: crew.championships.map(({ championship, carId }) => ({ championship, carId: carId === null ? '' : String(carId) })),
  color: crew.color ?? '',
  discordChannelId: crew.discordChannelId ?? '',
  discordRoleId: crew.discordRoleId ?? '',
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
  // Anche il ruolo è facoltativo: vuoto va bene, altrimenti deve essere un ID o una menzione di ruolo.
  const isRoleInvalid = values.discordRoleId.trim() !== '' && normalizeDiscordRoleId(values.discordRoleId) === null;
  // Nome, numero e colore obbligatori; i campionati possono anche mancare, ma ognuno con la sua auto.
  const isComplete =
    nameIssue === null &&
    parseCrewNumber(values.numberText) !== null &&
    values.championships.every((entry) => entry.carId !== '') &&
    values.color !== '' &&
    !isChannelInvalid &&
    !isRoleInvalid;

  return {
    values,
    changeName: (name: string) => {
      setValues((previousValues) => ({ ...previousValues, name }));
    },
    changeNumber: (typedValue: string) => {
      setValues((previousValues) => ({ ...previousValues, numberText: sanitizeCrewNumberInput(typedValue) }));
    },
    /** Aggiunge un campionato (senza auto), nell'ordine dei campionati. */
    addChampionship: (championship: CrewChampionship) => {
      setValues((previousValues) =>
        previousValues.championships.some((entry) => entry.championship === championship)
          ? previousValues
          : {
              ...previousValues,
              championships: [...previousValues.championships, { championship, carId: '' }].sort(
                (first, second) => CREW_CHAMPIONSHIPS.indexOf(first.championship) - CREW_CHAMPIONSHIPS.indexOf(second.championship),
              ),
            },
      );
    },
    /** La X accanto al campionato: l'equipaggio esce da quel campionato. */
    removeChampionship: (championship: CrewChampionship) => {
      setValues((previousValues) => ({ ...previousValues, championships: previousValues.championships.filter((entry) => entry.championship !== championship) }));
    },
    changeChampionshipCar: (championship: CrewChampionship, carId: string) => {
      setValues((previousValues) => ({
        ...previousValues,
        championships: previousValues.championships.map((entry) => (entry.championship === championship ? { ...entry, carId } : entry)),
      }));
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
    changeDiscordRole: (discordRoleId: string) => {
      setValues((previousValues) => ({ ...previousValues, discordRoleId }));
    },
    /** Uscendo dal campo, una menzione del ruolo diventa il suo ID. */
    normalizeDiscordRole: () => {
      setValues((previousValues) => ({
        ...previousValues,
        discordRoleId: normalizeDiscordRoleId(previousValues.discordRoleId) ?? previousValues.discordRoleId.trim(),
      }));
    },
    isChannelInvalid,
    isRoleInvalid,
    /** I campi vuoti non mostrano errori: tengono solo disattivato il pulsante. */
    visibleNameIssue: nameIssue === 'required' ? null : nameIssue,
    isComplete,
    /** Stessa convalida del server, con i valori già in forma canonica. */
    validate: () =>
      validateCrewDraft({
        name: values.name,
        number: parseCrewNumber(values.numberText),
        championships: toCrewChampionships(values.championships),
        color: values.color,
        discordChannelId: values.discordChannelId,
        discordRoleId: values.discordRoleId,
      }),
  };
}

export type CrewDraftState = ReturnType<typeof useCrewDraft>;
