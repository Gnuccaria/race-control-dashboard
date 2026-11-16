import { describe, expect, it } from 'vitest';
import { computeLapGap } from './lapGap';

describe('distacco dal leader', () => {
  const leader = { position: 1, laps: 203 };

  it('il leader è "Leader", poi stesso giro o giri in meno (sempre positivi)', () => {
    expect(computeLapGap(leader, leader)).toEqual({ kind: 'leader' });
    expect(computeLapGap({ position: 2, laps: 203 }, leader)).toEqual({ kind: 'same-lap' });
    expect(computeLapGap({ position: 3, laps: 201 }, leader)).toEqual({ kind: 'laps-behind', laps: 2 });
  });

  it('senza giri non si calcola', () => {
    expect(computeLapGap({ position: 2, laps: null }, leader)).toEqual({ kind: 'unknown' });
    expect(computeLapGap({ position: 2, laps: 200 }, { position: 1, laps: null })).toEqual({ kind: 'unknown' });
    expect(computeLapGap({ position: 2, laps: 200 }, undefined)).toEqual({ kind: 'unknown' });
  });
});
