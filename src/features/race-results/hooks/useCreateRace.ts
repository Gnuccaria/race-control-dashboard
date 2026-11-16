import type { RaceDraft } from '@shared/raceRules';
import { startTransition, useActionState } from 'react';
import { useNavigate } from 'react-router';
import type { ServerErrorKind } from '@/services/serverApi';
import { createRace } from '../services/raceApi';

type CreateRaceState = { readonly status: 'idle' } | { readonly status: 'failed'; readonly errorKind: ServerErrorKind };

/** Stato passato al dettaglio dopo la creazione, per mostrare la conferma. */
export interface NewRaceLocationState {
  readonly isNewRace: true;
}

/** Salvataggio della nuova gara; a operazione riuscita si apre il suo dettaglio (…/ordini-di-arrivo/<id>). */
export function useCreateRace() {
  const navigate = useNavigate();
  const [createState, dispatchCreate, isCreating] = useActionState<CreateRaceState, RaceDraft>(async (_previousState, race) => {
    const creationResult = await createRace(race);
    if (!creationResult.isSuccess) return { status: 'failed', errorKind: creationResult.errorKind };

    const locationState: NewRaceLocationState = { isNewRace: true };
    await navigate(`../${creationResult.value.id}`, { relative: 'path', replace: true, state: locationState });
    return { status: 'idle' };
  }, { status: 'idle' });

  return {
    createErrorKind: createState.status === 'failed' ? createState.errorKind : null,
    isCreating,
    submitRace: (race: RaceDraft) => {
      startTransition(() => {
        dispatchCreate(race);
      });
    },
  };
}
