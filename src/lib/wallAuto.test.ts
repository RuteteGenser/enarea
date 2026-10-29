import { describe, expect, it } from 'vitest';
import { outerSides } from '@/lib/wallAuto';
import type { Annotation } from '@/types';

const room = (id: string, x0: number, y0: number, x1: number, y1: number): Annotation => ({
  id,
  fileId: 'f',
  type: 'rectangle',
  points: [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
  color: 'blue',
  locked: false,
  visible: true,
  createdAt: 1,
  updatedAt: 1,
});

describe('outerSides', () => {
  it('marks all four sides of a lone room as outer', () => {
    const a = room('a', 0, 0, 100, 100);
    expect(outerSides(a, [a], 5)).toEqual([true, true, true, true]);
  });

  it('leaves out the side shared with a room next to it (across a wall thickness)', () => {
    const a = room('a', 0, 0, 100, 100);
    const b = room('b', 104, 0, 200, 100); // 4 units of wall between them
    expect(outerSides(a, [a, b], 5)).toEqual([true, false, true, true]); // right side (index 1) is shared
    expect(outerSides(b, [a, b], 5)).toEqual([true, true, true, false]); // left side (index 3)
  });

  it('keeps a side outer when the neighbour is further away than a wall', () => {
    const a = room('a', 0, 0, 100, 100);
    const b = room('b', 130, 0, 200, 100);
    expect(outerSides(a, [a, b], 5)).toEqual([true, true, true, true]);
  });

  it('keeps a side outer when the neighbour only touches a small part of it', () => {
    const a = room('a', 0, 0, 100, 100);
    const small = room('s', 103, 0, 150, 20); // touches 20% of the right side
    expect(outerSides(a, [a, small], 5)[1]).toBe(true);
  });

  it('ignores lines and the room itself', () => {
    const a = room('a', 0, 0, 100, 100);
    const line: Annotation = { ...room('l', 100, 0, 100, 100), type: 'line' };
    expect(outerSides(a, [a, line], 5)).toEqual([true, true, true, true]);
  });
});
