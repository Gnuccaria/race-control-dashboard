import type { ComponentType } from 'react';
import { BopDeficitIcon } from '@/features/bop-deficit/BopDeficitIcon';
import { BOP_DEFICIT_TOOL_INFO } from '@/features/bop-deficit/toolInfo';
import { RaceBriefingIcon } from '@/features/documentation/RaceBriefingIcon';
import { RACE_BRIEFING_TOOL_INFO } from '@/features/documentation/toolInfo';
import { ADD_CREW_TOOL_INFO, MANAGE_CREWS_TOOL_INFO } from '@/features/crews/addCrewToolInfo';
import { AddCrewIcon, ManageCrewsIcon } from '@/features/crews/CrewIcons';
import { FieDisconnectionsIcon } from '@/features/fie-disconnections/FieDisconnectionsIcon';
import { FIE_DISCONNECTIONS_TOOL_INFO } from '@/features/fie-disconnections/toolInfo';
import { LapCalculatorIcon } from '@/features/lap-calculator/LapCalculatorIcon';
import { LAP_CALCULATOR_TOOL_INFO } from '@/features/lap-calculator/toolInfo';
import { RaceResultsIcon } from '@/features/race-results/RaceResultsIcon';
import { DriverSwapsIcon } from '@/features/race-results/DriverSwapsIcon';
import { MANAGE_DRIVER_SWAPS_TOOL_INFO, MANAGE_RESULTS_TOOL_INFO } from '@/features/race-results/raceResultsToolInfo';
import { ProtestIcon } from '@/features/protests/ProtestIcon';
import { MANAGE_PROTESTS_TOOL_INFO } from '@/features/protests/protestsToolInfo';
import type { AppAccess } from '@/features/auth/model/discordProfile';
import type { Messages } from '@/i18n/messages';

type PageLoader = () => Promise<{ Component: ComponentType }>;

/** Pagina interna di uno strumento, es. il dettaglio di un equipaggio. */
export interface ToolSubPage {
  /** Relativo al percorso dello strumento, es. ":crewId". */
  readonly path: string;
  readonly loadPage: PageLoader;
}

/** Uno strumento è utilizzabile (con la sua pagina, caricata in lazy) oppure ancora in costruzione. */
export type ToolAvailability =
  | { readonly status: 'available'; readonly loadPage: PageLoader; readonly subPages?: readonly ToolSubPage[] }
  | { readonly status: 'under-construction' };

export interface ToolDefinition {
  /** Ultimo segmento dell'URL, es. "calcolatore-giri". */
  readonly slug: string;
  /** Chiave del nome e della descrizione tradotti in messages.tools. */
  readonly messageKey: keyof Messages['tools'];
  readonly Icon: ComponentType;
  readonly availability: ToolAvailability;
}

export interface ToolSection {
  readonly id: string;
  /** Primo segmento dell'URL degli strumenti della sezione, es. "campionato". */
  readonly pathSegment: string;
  /** Chiave del titolo tradotto in messages.home.sections. */
  readonly messageKey: keyof Messages['home']['sections'];
  /** Ruolo necessario per vedere e aprire gli strumenti della sezione (Organizzazione, Direttore Gara, Commissari). */
  readonly requiredAccess?: keyof AppAccess;
  readonly tools: readonly ToolDefinition[];
}

/** La sezione è visibile a questo utente? */
export const canUseSection = (section: ToolSection, access: AppAccess): boolean => !section.requiredAccess || access[section.requiredAccess];

/**
 * Unica fonte di verità di sezioni e strumenti: da qui derivano le card della home e le rotte.
 * Per aggiungere uno strumento basta aggiungere una voce nella sezione giusta; con
 * availability: { status: 'under-construction' } la card compare disattivata con "In costruzione".
 */
export const TOOL_SECTIONS: readonly ToolSection[] = [
  {
    id: 'championship',
    pathSegment: 'campionato',
    messageKey: 'championship',
    requiredAccess: 'organization',
    tools: [
      {
        ...ADD_CREW_TOOL_INFO,
        Icon: AddCrewIcon,
        availability: {
          status: 'available',
          loadPage: async () => {
            const { AddCrewPage } = await import('@/features/crews');
            return { Component: AddCrewPage };
          },
        },
      },
      {
        ...MANAGE_CREWS_TOOL_INFO,
        Icon: ManageCrewsIcon,
        availability: {
          status: 'available',
          loadPage: async () => {
            const { ManageCrewsPage } = await import('@/features/crews');
            return { Component: ManageCrewsPage };
          },
          subPages: [
            {
              path: ':crewId',
              loadPage: async () => {
                const { CrewDetailPage } = await import('@/features/crews');
                return { Component: CrewDetailPage };
              },
            },
          ],
        },
      },
      {
        ...MANAGE_RESULTS_TOOL_INFO,
        Icon: RaceResultsIcon,
        availability: {
          status: 'available',
          loadPage: async () => {
            const { ManageRacesPage } = await import('@/features/race-results');
            return { Component: ManageRacesPage };
          },
          subPages: [
            {
              // Prima del dettaglio: "nuova" non è l'id di una gara.
              path: 'nuova',
              loadPage: async () => {
                const { CreateRacePage } = await import('@/features/race-results');
                return { Component: CreateRacePage };
              },
            },
            {
              // Prima del dettaglio della penalità: "nuova" non è un id.
              path: ':raceId/penalita/nuova',
              loadPage: async () => {
                const { CreatePenaltyPage } = await import('@/features/race-results');
                return { Component: CreatePenaltyPage };
              },
            },
            {
              path: ':raceId/penalita/:penaltyId',
              loadPage: async () => {
                const { PenaltyDetailPage } = await import('@/features/race-results');
                return { Component: PenaltyDetailPage };
              },
            },
            {
              path: ':raceId',
              loadPage: async () => {
                const { RaceDetailPage } = await import('@/features/race-results');
                return { Component: RaceDetailPage };
              },
            },
          ],
        },
      },
    ],
  },
  {
    id: 'documentation',
    pathSegment: 'documentazione',
    messageKey: 'documentation',
    requiredAccess: 'raceControl',
    tools: [{ ...RACE_BRIEFING_TOOL_INFO, Icon: RaceBriefingIcon, availability: { status: 'under-construction' } }],
  },
  {
    id: 'race-control',
    pathSegment: 'strumenti',
    messageKey: 'raceControl',
    requiredAccess: 'raceControl',
    tools: [
      {
        ...LAP_CALCULATOR_TOOL_INFO,
        Icon: LapCalculatorIcon,
        availability: {
          status: 'available',
          loadPage: async () => {
            const { LapCalculator } = await import('@/features/lap-calculator');
            return { Component: LapCalculator };
          },
        },
      },
      {
        ...BOP_DEFICIT_TOOL_INFO,
        Icon: BopDeficitIcon,
        availability: {
          status: 'available',
          loadPage: async () => {
            const { BopDeficitCalculator } = await import('@/features/bop-deficit');
            return { Component: BopDeficitCalculator };
          },
        },
      },
      {
        ...FIE_DISCONNECTIONS_TOOL_INFO,
        Icon: FieDisconnectionsIcon,
        availability: {
          status: 'available',
          loadPage: async () => {
            const { FieDisconnectionsCalculator } = await import('@/features/fie-disconnections');
            return { Component: FieDisconnectionsCalculator };
          },
        },
      },
    ],
  },
  {
    id: 'stewards',
    pathSegment: 'commissari',
    messageKey: 'stewards',
    requiredAccess: 'stewards',
    tools: [
      {
        ...MANAGE_PROTESTS_TOOL_INFO,
        Icon: ProtestIcon,
        availability: {
          status: 'available',
          loadPage: async () => {
            const { ManageProtestsPage } = await import('@/features/protests');
            return { Component: ManageProtestsPage };
          },
          subPages: [
            {
              path: ':protestId',
              loadPage: async () => {
                const { ProtestDetailPage } = await import('@/features/protests');
                return { Component: ProtestDetailPage };
              },
            },
          ],
        },
      },
      {
        ...MANAGE_DRIVER_SWAPS_TOOL_INFO,
        Icon: DriverSwapsIcon,
        availability: {
          status: 'available',
          loadPage: async () => {
            const { ManageDriverSwapsPage } = await import('@/features/race-results');
            return { Component: ManageDriverSwapsPage };
          },
          subPages: [
            {
              path: ':raceId',
              loadPage: async () => {
                const { DriverSwapRaceDetailPage } = await import('@/features/race-results');
                return { Component: DriverSwapRaceDetailPage };
              },
            },
          ],
        },
      },
    ],
  },
];

/** Percorso della rotta relativo alla radice (senza slash iniziale), es. "strumenti/calcolatore-giri". */
export const getToolRoutePath = (section: ToolSection, tool: ToolDefinition): string =>
  `${section.pathSegment}/${tool.slug}`;

/** URL da usare nei link. */
export const getToolHref = (section: ToolSection, tool: ToolDefinition): string => `/${getToolRoutePath(section, tool)}`;
