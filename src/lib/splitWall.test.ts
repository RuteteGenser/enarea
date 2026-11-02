import { describe, expect, it } from 'vitest';
import { splitEdge, splitPlacements } from '@/lib/splitWall';
import type { PlacedOpening } from '@/types';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('splitEdge', () => {
  it('adds a midpoint and gives both halves the original marking', () => {
    const { points, edges } = splitEdge({ points: square, edges: [{}, { wallType: 'external' }, {}, {}] }, 1);
    expect(points).toHaveLength(5);
    expect(points[2]).toEqual({ x: 10, y: 5 });
    expect(edges.map((e) => e.wallType)).toEqual([undefined, 'external', 'external', undefined, undefined]);
  });

  it('works for the closing side and for areas without edge data', () => {
    const { points, edges } = splitEdge({ points: square }, 3);
    expect(points[4]).toEqual({ x: 0, y: 5 });
    expect(edges).toHaveLength(5);
  });
});

describe('splitPlacements', () => {
  const p = (id: string, edgeIndex: number, t: number, annotationId = 'a'): PlacedOpening => ({ id, openingId: 'o', annotationId, edgeIndex, t });

  it('moves openings to the right half and renumbers later sides', () => {
    const result = splitPlacements([p('1', 1, 0.25), p('2', 1, 0.75), p('3', 2, 0.5), p('4', 0, 0.5), p('5', 1, 0.5, 'b')], 'a', 1);
    expect(result).toEqual([p('1', 1, 0.5), p('2', 2, 0.5), p('3', 3, 0.5), p('4', 0, 0.5), p('5', 1, 0.5, 'b')]);
  });
});

import { removeCornerPlacements } from '@/lib/splitWall';

describe('removeCornerPlacements', () => {
  // square 10x10 with corners 0..3; edges 0 (top), 1 (right), 2 (bottom), 3 (left)
  const p = (id: string, edgeIndex: number, t: number): PlacedOpening => ({ id, openingId: 'o', annotationId: 'a', edgeIndex, t });

  it('slides windows on the two joined sides onto the joined side and renumbers later sides', () => {
    // removing corner 1 joins edge 0 and edge 1 (both length 10) into one side of length 20
    const result = removeCornerPlacements([p('1', 0, 0.5), p('2', 1, 0.5), p('3', 2, 0.5), p('4', 3, 0.2)], 'a', square, 1);
    expect(result).toEqual([p('1', 0, 0.25), p('2', 0, 0.75), p('3', 1, 0.5), p('4', 2, 0.2)]);
  });

  it('handles removing the first corner (the joined side is the last one)', () => {
    const result = removeCornerPlacements([p('1', 3, 0.5), p('2', 0, 0.5), p('3', 1, 0.5)], 'a', square, 0);
    expect(result).toEqual([p('1', 2, 0.25), p('2', 2, 0.75), p('3', 0, 0.5)]);
  });
});
