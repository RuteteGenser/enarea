import { describe, expect, it } from 'vitest';
import { nearestEdge, nextOpeningName, openingArea, openingRect } from '@/lib/openings';
import type { Annotation, OpeningItem } from '@/types';

const item = (name: string): OpeningItem => ({ id: name, kind: 'vindu', name });

describe('nextOpeningName', () => {
  it('numbers windows and doors in one running sequence', () => {
    expect(nextOpeningName([], 'vindu')).toBe('Vindu 1');
    expect(nextOpeningName([item('Vindu 1')], 'vindu')).toBe('Vindu 2');
    expect(nextOpeningName([item('Vindu 1'), item('Vindu 2')], 'dor')).toBe('Dør 3');
  });

  it('continues after the highest number even with gaps', () => {
    expect(nextOpeningName([item('Vindu 1'), item('Dør 5')], 'vindu')).toBe('Vindu 6');
  });
});

describe('openingArea', () => {
  it('converts mm to m²', () => {
    expect(openingArea({ widthMm: 1200, heightMm: 1500 })).toBeCloseTo(1.8);
    expect(openingArea({ widthMm: 1200 })).toBeUndefined();
  });
});

describe('openingRect', () => {
  it('lays the rectangle along the wall', () => {
    const r = openingRect({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.5, 20, 4);
    expect(r.center).toEqual({ x: 50, y: 0 });
    const xs = r.corners.map((c) => c.x);
    const ys = r.corners.map((c) => c.y);
    expect(Math.min(...xs)).toBeCloseTo(40);
    expect(Math.max(...xs)).toBeCloseTo(60);
    expect(Math.min(...ys)).toBeCloseTo(-2);
    expect(Math.max(...ys)).toBeCloseTo(2);
  });
});

describe('nearestEdge', () => {
  const room: Annotation = {
    id: 'r',
    fileId: 'f',
    type: 'rectangle',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
    color: 'blue',
    locked: false,
    visible: true,
    createdAt: 1,
    updatedAt: 1,
  };

  it('finds the side under the point and the position along it', () => {
    const hit = nearestEdge({ x: 30, y: 3 }, [room], 10, 20);
    expect(hit?.edgeIndex).toBe(0);
    expect(hit?.t).toBeCloseTo(0.3);
  });

  it('keeps the opening inside the side near a corner', () => {
    const hit = nearestEdge({ x: 2, y: 1 }, [room], 10, 20);
    expect(hit?.t).toBeCloseTo(0.1); // half of 20 on a 100-long side
  });

  it('returns null when nothing is close', () => {
    expect(nearestEdge({ x: 50, y: 50 }, [room], 10, 20)).toBeNull();
  });
});
