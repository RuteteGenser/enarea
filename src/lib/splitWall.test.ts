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
