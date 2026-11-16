import { describe, expect, it } from 'vitest';
import { computeLapsBehind } from './lapsBehind';

describe('computeLapsBehind', () => {
  it('conta i giri in meno rispetto al primo', () => {
    expect(computeLapsBehind(203, 202)).toBe(1);
    expect(computeLapsBehind(203, 196)).toBe(7);
  });

  it('non mostra nulla a parità di giri, con più giri o con giri mancanti', () => {
    expect(computeLapsBehind(203, 203)).toBeNull();
    expect(computeLapsBehind(200, 203)).toBeNull();
    expect(computeLapsBehind(null, 200)).toBeNull();
    expect(computeLapsBehind(203, null)).toBeNull();
  });
});
