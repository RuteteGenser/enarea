import { describe, expect, it } from 'vitest';
import {
  buildSnapCandidates,
  distance,
  findSnapCandidate,
  midpoint,
  polygonArea,
  polygonPerimeter,
  rectangleFromCorners,
} from '@/lib/geometry';
import type { Annotation } from '@/types';

describe('distance', () => {
  it('computes euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('midpoint', () => {
  it('averages two points', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 4 })).toEqual({ x: 5, y: 2 });
  });
});

describe('polygonArea', () => {
  it('computes the area of a 10x5 rectangle', () => {
    const points = rectangleFromCorners({ x: 0, y: 0 }, { x: 10, y: 5 });
    expect(polygonArea(points)).toBe(50);
  });

  it('computes the area of a triangle', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 3 },
    ];
    expect(polygonArea(points)).toBe(6);
  });

  it('returns 0 for fewer than 3 points', () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
  });

  it('is winding-order independent', () => {
    const clockwise = [
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 10, y: 5 },
      { x: 10, y: 0 },
    ];
    expect(polygonArea(clockwise)).toBe(50);
  });
});

describe('polygonPerimeter', () => {
  it('sums the closed-loop edge lengths', () => {
    const points = rectangleFromCorners({ x: 0, y: 0 }, { x: 3, y: 4 });
    expect(polygonPerimeter(points)).toBe(14);
  });
});

describe('rectangleFromCorners', () => {
  it('produces 4 axis-aligned corners', () => {
    const points = rectangleFromCorners({ x: 2, y: 2 }, { x: 8, y: 6 });
    expect(points).toEqual([
      { x: 2, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 6 },
      { x: 2, y: 6 },
    ]);
  });
});

describe('findSnapCandidate', () => {
  const toScreen = (p: { x: number; y: number }) => p;

  it('returns the nearest candidate within the threshold', () => {
    const candidates = [
      { point: { x: 0, y: 0 }, kind: 'vertex' as const },
      { point: { x: 100, y: 100 }, kind: 'vertex' as const },
    ];
    const result = findSnapCandidate({ x: 3, y: 4 }, candidates, toScreen, 10);
    expect(result?.point).toEqual({ x: 0, y: 0 });
  });

  it('returns null when nothing is within the threshold', () => {
    const candidates = [{ point: { x: 0, y: 0 }, kind: 'vertex' as const }];
    const result = findSnapCandidate({ x: 50, y: 50 }, candidates, toScreen, 10);
    expect(result).toBeNull();
  });
});

describe('buildSnapCandidates', () => {
  function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
    return {
      id: 'a1',
      fileId: 'f1',
      type: 'polygon',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      color: 'blue',
      locked: false,
      visible: true,
      createdAt: 0,
      updatedAt: 0,
      ...overrides,
    };
  }

  it('includes vertices and edge midpoints for closed shapes', () => {
    const candidates = buildSnapCandidates([makeAnnotation()]);
    const vertexCount = candidates.filter((c) => c.kind === 'vertex').length;
    const midpointCount = candidates.filter((c) => c.kind === 'midpoint').length;
    expect(vertexCount).toBe(3);
    expect(midpointCount).toBe(3);
  });

  it('excludes hidden annotations', () => {
    const candidates = buildSnapCandidates([makeAnnotation({ visible: false })]);
    expect(candidates).toHaveLength(0);
  });

  it('excludes the annotation matching excludeId', () => {
    const candidates = buildSnapCandidates([makeAnnotation({ id: 'skip-me' })], 'skip-me');
    expect(candidates).toHaveLength(0);
  });

  it('treats a line as having a single segment (no wrap-around edge)', () => {
    const line = makeAnnotation({
      type: 'line',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    });
    const candidates = buildSnapCandidates([line]);
    const midpointCount = candidates.filter((c) => c.kind === 'midpoint').length;
    expect(midpointCount).toBe(1);
  });
});
