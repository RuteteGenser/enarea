import { describe, expect, it } from 'vitest';
import { areaAtPoint, movePersonMarkers, trimPersonMarkers, withPersonAdded, withPersonRemoved } from '@/lib/personMarkers';
import type { Annotation } from '@/types';

const rect = (id: string, x0: number, y0: number, x1: number, y1: number): Annotation => ({
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

describe('areaAtPoint', () => {
  const big = rect('big', 0, 0, 100, 100);
  const small = rect('small', 10, 10, 40, 40);

  it('finds the area under the point, preferring the smaller one', () => {
    expect(areaAtPoint([big, small], { x: 20, y: 20 })?.id).toBe('small');
    expect(areaAtPoint([big, small], { x: 70, y: 70 })?.id).toBe('big');
  });

  it('returns undefined outside every area', () => {
    expect(areaAtPoint([big, small], { x: 150, y: 20 })).toBeUndefined();
  });

  it('ignores hidden areas and lines', () => {
    expect(areaAtPoint([{ ...big, visible: false }], { x: 20, y: 20 })).toBeUndefined();
    expect(areaAtPoint([{ ...big, type: 'line' }], { x: 20, y: 20 })).toBeUndefined();
  });
});

describe('adding and removing persons', () => {
  it('counts a placed person in the area', () => {
    let area = rect('a', 0, 0, 100, 100);
    area = { ...area, ...withPersonAdded(area, { x: 5, y: 6 }, 'p1') };
    area = { ...area, ...withPersonAdded(area, { x: 50, y: 60 }, 'p2') };
    expect(area.people).toBe(2);
    expect(area.personMarkers).toEqual([
      { id: 'p1', x: 5, y: 6 },
      { id: 'p2', x: 50, y: 60 },
    ]);
  });

  it('keeps people entered by hand and only takes one off when removing an icon', () => {
    const area = { ...rect('a', 0, 0, 100, 100), people: 5, personMarkers: [{ id: 'p1', x: 1, y: 1 }] };
    const patch = withPersonRemoved(area, 'p1');
    expect(patch.people).toBe(4);
    expect(patch.personMarkers).toBeUndefined();
  });

  it('never goes below zero', () => {
    const area = { ...rect('a', 0, 0, 1, 1), people: undefined, personMarkers: [{ id: 'p1', x: 0, y: 0 }] };
    expect(withPersonRemoved(area, 'p1').people).toBeUndefined();
  });
});

describe('movePersonMarkers', () => {
  it('offsets markers and gives them new ids (for copy/paste)', () => {
    let n = 0;
    expect(movePersonMarkers([{ id: 'x', x: 1, y: 2 }], 12, 12, () => `n${++n}`)).toEqual([{ id: 'n1', x: 13, y: 14 }]);
    expect(movePersonMarkers(undefined, 12, 12, () => 'n')).toBeUndefined();
  });
});

describe('trimPersonMarkers', () => {
  const markers = [
    { id: 'a', x: 1, y: 1 },
    { id: 'b', x: 2, y: 2 },
    { id: 'c', x: 3, y: 3 },
  ];

  it('keeps the earliest icons up to the new count', () => {
    expect(trimPersonMarkers(markers, 2)?.map((m) => m.id)).toEqual(['a', 'b']);
    expect(trimPersonMarkers(markers, 5)).toHaveLength(3);
  });

  it('removes all icons at zero', () => {
    expect(trimPersonMarkers(markers, 0)).toBeUndefined();
    expect(trimPersonMarkers(undefined, 2)).toBeUndefined();
  });
});
