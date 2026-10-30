import { describe, expect, it } from 'vitest';
import { areaLabelPoint, labelPoint } from '@/lib/labelPoint';
import { isPointInPolygon } from '@/lib/geometry';
import type { Point } from '@/types';

const rect = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

describe('labelPoint', () => {
  it('is the middle of a rectangle', () => {
    const p = labelPoint(rect(0, 0, 100, 60));
    expect(p.x).toBeCloseTo(50, 0);
    expect(p.y).toBeCloseTo(30, 0);
  });

  it('stays well inside an L-shaped room, in its widest part', () => {
    const l: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 100 },
      { x: 0, y: 100 },
    ];
    const p = labelPoint(l);
    expect(isPointInPolygon(p, l)).toBe(true);
    // clearly away from every side (the arms are 20–30 wide, so about 10–15 from the nearest side)
    const edgeDist = Math.min(p.x, 100 - p.x, p.y, 100 - p.y);
    expect(edgeDist).toBeGreaterThan(8);
  });

  it('never returns a point outside a U-shaped room', () => {
    const u: Point[] = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 70 },
      { x: 70, y: 70 },
      { x: 70, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(isPointInPolygon(labelPoint(u), u)).toBe(true);
  });

  it('uses the biggest ring of a multi-part area', () => {
    const p = areaLabelPoint(rect(0, 0, 10, 10), [rect(100, 100, 200, 160)]);
    expect(p.x).toBeCloseTo(150, 0);
    expect(p.y).toBeCloseTo(130, 0);
  });
});
