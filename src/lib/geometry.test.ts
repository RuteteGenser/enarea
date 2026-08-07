import { describe, expect, it } from 'vitest';
import {
  annotationArea,
  buildSnapCandidates,
  constrainAngle,
  distance,
  findSnapCandidate,
  isPointInPolygon,
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

describe('constrainAngle', () => {
  it('leaves a purely horizontal cursor unchanged', () => {
    const result = constrainAngle({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(result.x).toBeCloseTo(10, 6);
    expect(result.y).toBeCloseTo(0, 6);
  });

  it('leaves a purely vertical cursor unchanged', () => {
    const result = constrainAngle({ x: 0, y: 0 }, { x: 0, y: 10 });
    expect(result.x).toBeCloseTo(0, 6);
    expect(result.y).toBeCloseTo(10, 6);
  });

  it('snaps a near-diagonal cursor to exactly 45 degrees, preserving distance', () => {
    const reference = { x: 0, y: 0 };
    const cursor = { x: 10, y: 9 }; // close to but not exactly 45°
    const result = constrainAngle(reference, cursor);
    expect(result.x).toBeCloseTo(result.y, 6);
    expect(distance(reference, result)).toBeCloseTo(distance(reference, cursor), 6);
  });

  it('snaps a mostly-horizontal cursor to the horizontal axis', () => {
    const result = constrainAngle({ x: 5, y: 5 }, { x: 15, y: 6 });
    expect(result.y).toBeCloseTo(5, 6);
  });

  it('returns the reference point unchanged when cursor is at the same position', () => {
    const reference = { x: 3, y: 4 };
    expect(constrainAngle(reference, { x: 3, y: 4 })).toEqual({ x: 3, y: 4 });
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

describe('annotationArea', () => {
  function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
    return {
      id: 'a1',
      fileId: 'f1',
      type: 'polygon',
      points: rectangleFromCorners({ x: 0, y: 0 }, { x: 10, y: 5 }),
      color: 'blue',
      locked: false,
      visible: true,
      createdAt: 0,
      updatedAt: 0,
      ...overrides,
    };
  }

  it('matches plain polygonArea when there are no extra regions', () => {
    const annotation = makeAnnotation();
    expect(annotationArea(annotation)).toBe(polygonArea(annotation.points));
  });

  it('sums the primary ring and every extra region', () => {
    const annotation = makeAnnotation({
      regions: [rectangleFromCorners({ x: 20, y: 0 }, { x: 24, y: 3 })],
    });
    expect(annotationArea(annotation)).toBe(50 + 12);
  });

  it('uses primaryOverride for the primary ring while still adding regions', () => {
    const annotation = makeAnnotation({
      regions: [rectangleFromCorners({ x: 20, y: 0 }, { x: 24, y: 3 })],
    });
    const liveOverride = rectangleFromCorners({ x: 0, y: 0 }, { x: 2, y: 2 });
    expect(annotationArea(annotation, liveOverride)).toBe(4 + 12);
  });
});

describe('isPointInPolygon', () => {
  const square = rectangleFromCorners({ x: 0, y: 0 }, { x: 10, y: 10 });

  it('returns true for a point clearly inside', () => {
    expect(isPointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
  });

  it('returns false for a point clearly outside', () => {
    expect(isPointInPolygon({ x: 20, y: 20 }, square)).toBe(false);
  });

  it('handles a concave (L-shaped) polygon correctly', () => {
    const lShape = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(isPointInPolygon({ x: 2, y: 2 }, lShape)).toBe(true);
    expect(isPointInPolygon({ x: 8, y: 8 }, lShape)).toBe(false);
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
