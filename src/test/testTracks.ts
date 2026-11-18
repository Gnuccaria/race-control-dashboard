import type { Track } from '@shared/raceRules';

const track = (id: number, name: string, configuration: string, country: string, lengthMeters: number | null, hasReverseLayout: boolean, mapFile: string | null = null): Track => ({
  id,
  name,
  configuration,
  country,
  lengthMeters,
  hasReverseLayout,
  mapFile,
  reverseMapFile: null,
});

/** Piste finte per i test: tre nazioni, un tracciato con più configurazioni, una con il senso inverso. */
export const TEST_TRACKS: Track[] = [
  track(1, 'Alsace', 'Village', 'FR', 5423, true, 'alsace-village.png'),
  track(2, 'Monza', 'Full Course', 'IT', 5793, false, 'monza.png'),
  track(3, 'Monza', 'No Chicane', 'IT', 5755, false),
  track(4, 'Suzuka Circuit', 'Full Course', 'JP', 5807, false),
  track(5, 'Suzuka Circuit', 'East Course', 'JP', 2243, false),
  track(6, 'Tsukuba Circuit', 'Full Course', 'JP', null, false),
];
