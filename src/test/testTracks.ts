import type { Track } from '@shared/raceRules';

/** Piste finte per i test: due continenti, un tracciato con più configurazioni, una con il senso inverso. */
export const TEST_TRACKS: Track[] = [
  { id: 1, name: 'Alsace', configuration: 'Village', continent: 'Europe - Middle East', lengthMeters: 5423, hasReverseLayout: true },
  { id: 2, name: 'Monza', configuration: 'Full Course', continent: 'Europe - Middle East', lengthMeters: 5793, hasReverseLayout: false },
  { id: 3, name: 'Monza', configuration: 'No Chicane', continent: 'Europe - Middle East', lengthMeters: 5755, hasReverseLayout: false },
  { id: 4, name: 'Suzuka Circuit', configuration: 'Full Course', continent: 'Asia', lengthMeters: 5807, hasReverseLayout: false },
  { id: 5, name: 'Suzuka Circuit', configuration: 'East Course', continent: 'Asia', lengthMeters: 2243, hasReverseLayout: false },
  { id: 6, name: 'Tsukuba Circuit', configuration: 'Full Course', continent: 'Asia', lengthMeters: null, hasReverseLayout: false },
];
