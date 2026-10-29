import { describe, expect, it } from 'vitest';
import { compassPoint, orientationDegrees, outwardBearing, wallBearing, wallOrientation } from '@/lib/wallOrientation';
import type { Point } from '@/types';

// Screen coordinates (y grows downwards): a square listed clockwise as seen on the page.
const square: Point[] = [
  { x: 0, y: 0 }, // top-left
  { x: 100, y: 0 }, // top-right  -> edge 0 is the top side
  { x: 100, y: 100 }, // edge 1 is the right side
  { x: 0, y: 100 }, // edge 2 bottom, edge 3 left
];
const counterClockwise = [...square].reverse();

describe('compassPoint', () => {
  it('maps bearings to the eight points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(44)).toBe('NE');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(200)).toBe('S');
    expect(compassPoint(270)).toBe('W');
    expect(compassPoint(350)).toBe('N');
    expect(compassPoint(-90)).toBe('W');
  });
});

describe('outwardBearing', () => {
  it('with north up, the top side faces north, right side east, bottom south, left west', () => {
    expect(compassPoint(outwardBearing(square, 0, 0))).toBe('N');
    expect(compassPoint(outwardBearing(square, 1, 0))).toBe('E');
    expect(compassPoint(outwardBearing(square, 2, 0))).toBe('S');
    expect(compassPoint(outwardBearing(square, 3, 0))).toBe('W');
  });

  it('does not depend on the winding of the polygon', () => {
    // reversed list: its edge 3 is the top side (from top-left... see order) – check all four sides appear
    const dirs = [0, 1, 2, 3].map((i) => compassPoint(outwardBearing(counterClockwise, i, 0))).sort();
    expect(dirs).toEqual(['E', 'N', 'S', 'W']);
  });

  it('turns with the compass: north pointing right makes the top side face west', () => {
    // north is at 90° (to the right on the page): the top of the page then points west
    expect(compassPoint(outwardBearing(square, 0, 90))).toBe('W');
    expect(compassPoint(outwardBearing(square, 1, 90))).toBe('N'); // right side now faces north
  });
});

describe('wallOrientation', () => {
  const room = { points: square, edges: [{ wallType: 'external' as const }, {}, { wallType: 'external' as const, orientation: 'W' as const }, {}] };

  it('follows the compass for outer walls and honours a manual value', () => {
    expect(wallOrientation(room, 0, 0)).toBe('N');
    expect(wallOrientation(room, 0, 180)).toBe('S');
    expect(wallOrientation(room, 2, 0)).toBe('W'); // set by hand
  });

  it('is undefined for sides that are not outer walls', () => {
    expect(wallOrientation(room, 1, 0)).toBeUndefined();
  });
});

describe('wallBearing (degrees for Excel)', () => {
  const room = { points: square, edges: [{ wallType: 'external' as const }, { wallType: 'external' as const, orientation: 'S' as const }, {}, {}] };

  it('gives whole degrees from the compass', () => {
    expect(wallBearing(room, 0, 0)).toBe(0);
    expect(wallBearing(room, 0, 90)).toBe(270);
    expect(wallBearing(room, 0, 45)).toBe(315);
  });

  it('uses a hand-set direction as its degrees and skips non-outer sides', () => {
    expect(wallBearing(room, 1, 123)).toBe(180);
    expect(wallBearing(room, 2, 0)).toBeUndefined();
    expect(orientationDegrees('W')).toBe(270);
  });
});
