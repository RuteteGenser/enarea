import { describe, expect, it } from 'vitest';
import { joinPlacements, nearestEdge, nextOpeningName, normalizeOpenings, openingArea, openingRect } from '@/lib/openings';
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

describe('joinPlacements', () => {
  const type: OpeningItem = { id: 'w1', kind: 'vindu', name: 'Vindu 1', widthMm: 1200, heightMm: 1500, typeId: 'ty' };
  const p = (id: string, t: number) => ({ id, openingId: 'w1', annotationId: 'r', edgeIndex: 0, t });

  it('makes one entry per placed copy of the same type', () => {
    const joined = joinPlacements([type], [p('a', 0.2), p('b', 0.5), p('c', 0.8)]);
    expect(joined).toHaveLength(3);
    expect(joined.map((j) => j.id)).toEqual(['a', 'b', 'c']);
    for (const j of joined) expect(j).toMatchObject({ name: 'Vindu 1', widthMm: 1200, typeId: 'ty', openingId: 'w1' });
    expect(joined[2].placement.t).toBe(0.8);
  });

  it('skips placements whose type is gone', () => {
    expect(joinPlacements([], [p('a', 0.2)])).toEqual([]);
  });
});

describe('normalizeOpenings (older saves)', () => {
  it('turns a type that carried a placement into a type plus a placement', () => {
    const old: OpeningItem = { id: 'w1', kind: 'vindu', name: 'Vindu 1', placement: { annotationId: 'r', edgeIndex: 2, t: 0.4 } };
    const { openings, placedOpenings } = normalizeOpenings([old], undefined);
    expect(openings).toEqual([{ id: 'w1', kind: 'vindu', name: 'Vindu 1' }]);
    expect(placedOpenings).toEqual([{ id: 'w1', openingId: 'w1', annotationId: 'r', edgeIndex: 2, t: 0.4 }]);
  });

  it('folds the copies made by the earlier "place again" behaviour back into their type', () => {
    const original: OpeningItem = { id: 'w1', kind: 'vindu', name: 'Vindu 1', widthMm: 1200, placement: { annotationId: 'r', edgeIndex: 0, t: 0.2 } };
    const copy: OpeningItem = { id: 'c1', kind: 'vindu', name: 'Vindu 2', widthMm: 1200, templateId: 'w1', placement: { annotationId: 'r', edgeIndex: 0, t: 0.6 } };
    const { openings, placedOpenings } = normalizeOpenings([original, copy], []);
    expect(openings.map((o) => o.id)).toEqual(['w1']);
    expect(placedOpenings.map((p) => [p.id, p.openingId])).toEqual([['w1', 'w1'], ['c1', 'w1']]);
  });

  it('is idempotent and leaves unplaced types alone', () => {
    const type: OpeningItem = { id: 'd1', kind: 'dor', name: 'Dør 2' };
    const once = normalizeOpenings([type], []);
    expect(normalizeOpenings(once.openings, once.placedOpenings)).toEqual(once);
    expect(once.placedOpenings).toEqual([]);
  });
});
