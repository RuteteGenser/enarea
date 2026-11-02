import { describe, expect, it } from 'vitest';
import { bearingBetween, northFromWall } from '@/lib/north';

describe('bearingBetween', () => {
  it('is clockwise from up', () => {
    expect(bearingBetween({ x: 0, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(0);
    expect(bearingBetween({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(90);
    expect(bearingBetween({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(180);
    expect(bearingBetween({ x: 10, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(270);
  });
});

describe('northFromWall', () => {
  it('is 0 when the drawing is oriented like the screenshot', () => {
    expect(northFromWall(63, 63)).toBe(0);
  });

  it('a wall pointing east on the map and up on the drawing puts north 90° to the left (270°)', () => {
    expect(northFromWall(0, 90)).toBe(270);
  });

  it('wraps into 0–360', () => {
    expect(northFromWall(10, 350)).toBe(20);
  });
});
