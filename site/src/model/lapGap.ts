import type { PublicRaceResult } from '@shared/raceRules';

/**
 * Distacco dal leader in giri, sempre positivo: chi ha completato 2 giri in meno è "+2 giri".
 * Il leader è la prima posizione; senza i suoi giri (gare salvate prima dei giri) il distacco non si calcola.
 */
export type LapGap =
  | { readonly kind: 'leader' }
  | { readonly kind: 'same-lap' }
  | { readonly kind: 'laps-behind'; readonly laps: number }
  | { readonly kind: 'unknown' };

export function computeLapGap(result: Pick<PublicRaceResult, 'position' | 'laps'>, leader: Pick<PublicRaceResult, 'position' | 'laps'> | undefined): LapGap {
  if (leader && result.position === leader.position) return { kind: 'leader' };
  if (!leader || leader.laps === null || result.laps === null) return { kind: 'unknown' };
  const lapsBehind = Math.max(0, leader.laps - result.laps);
  return lapsBehind === 0 ? { kind: 'same-lap' } : { kind: 'laps-behind', laps: lapsBehind };
}
