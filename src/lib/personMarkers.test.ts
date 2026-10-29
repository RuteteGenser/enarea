import { describe, expect, it } from 'vitest';
import { areaAtPoint, interiorPoint, markersForPeople, movePersonMarkers, trimPersonMarkers, withPersonAdded, withPersonRemoved } from '@/lib/personMarkers';
import { isPointInPolygon } from '@/lib/geometry';
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

describe('markersForPeople', () => {
  let n = 0;
  const id = () => `m${++n}`;
  const room = rect('r', 0, 0, 100, 60);

  it('puts added people around the middle of the room, inside it', () => {
    const markers = markersForPeople(room, 4, 5, id) ?? [];
    expect(markers).toHaveLength(4);
    expect(markers[0]).toMatchObject({ x: 50, y: 30 });
    for (const m of markers) expect(isPointInPolygon(m, room.points)).toBe(true);
    // not stacked on top of each other
    expect(new Set(markers.map((m) => `${m.x},${m.y}`)).size).toBe(4);
  });

  it('keeps existing icons and only adds the missing ones', () => {
    const withOne = { ...room, personMarkers: [{ id: 'keep', x: 10, y: 10 }] };
    const markers = markersForPeople(withOne, 3, 5, id) ?? [];
    expect(markers).toHaveLength(3);
    expect(markers[0].id).toBe('keep');
  });

  it('removes icons when there are fewer people, and all at zero', () => {
    const three = { ...room, personMarkers: [1, 2, 3].map((i) => ({ id: `p${i}`, x: i, y: i })) };
    expect(markersForPeople(three, 1, 5, id)?.map((m) => m.id)).toEqual(['p1']);
    expect(markersForPeople(three, 0, 5, id)).toBeUndefined();
  });

  it('stays inside an L-shaped room whose centroid is outside it', () => {
    const l: Annotation = {
      ...room,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 100 },
        { x: 0, y: 100 },
      ],
    };
    const p = interiorPoint(l);
    expect(isPointInPolygon(p, l.points)).toBe(true);
    for (const m of markersForPeople(l, 3, 3, id) ?? []) expect(isPointInPolygon(m, l.points)).toBe(true);
  });
});
