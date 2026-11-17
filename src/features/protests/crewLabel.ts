import type { Protest } from '@shared/protestRules';

/** "#16 Vez Team Lime". */
export const crewLabel = (crew: Protest['crew']) => `#${crew.number} ${crew.name}`;
