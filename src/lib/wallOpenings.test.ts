import { describe, expect, it } from 'vitest';
import { openingsSummary, parseArea, totalOpeningArea } from '@/lib/wallOpenings';
import type { BuildingComponentAssignment, EdgeMeta } from '@/types';

const window: BuildingComponentAssignment = { typeId: 'w', category: 'vindu', name: 'Vindu 3-lags' };

describe('parseArea', () => {
  it('accepts comma and dot decimals', () => {
    expect(parseArea('2,4')).toBe(2.4);
    expect(parseArea(' 1.5 ')).toBe(1.5);
  });

  it('rejects empty, zero, negative and non-numbers', () => {
    expect(parseArea('')).toBeUndefined();
    expect(parseArea('0')).toBeUndefined();
    expect(parseArea('-1')).toBeUndefined();
    expect(parseArea('abc')).toBeUndefined();
  });
});

describe('opening totals', () => {
  const edge: EdgeMeta = {
    openings: [
      { id: 'a', component: window, area: 2.4 },
      { id: 'b', component: window, area: 1.1 },
    ],
  };

  it('sums the area of one wall', () => {
    expect(totalOpeningArea(edge)).toBeCloseTo(3.5);
    expect(totalOpeningArea({})).toBe(0);
  });

  it('sums count and area over all walls', () => {
    const s = openingsSummary({ edges: [edge, {}, { openings: [{ id: 'c', component: window, area: 1 }] }] });
    expect(s.count).toBe(3);
    expect(s.area).toBeCloseTo(4.5);
  });
});
