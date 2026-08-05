import type { Annotation, Point } from '@/types';

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Shoelace formula. Returns area in the same squared units as the input points. */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeter(points: Point[]): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += distance(points[i], points[(i + 1) % points.length]);
  }
  return sum;
}

export function rectangleFromCorners(a: Point, b: Point): Point[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y },
  ];
}

export type SnapCandidate = { point: Point; kind: 'vertex' | 'endpoint' | 'midpoint' };

/**
 * Finds the closest snap candidate within `thresholdPx` screen pixels.
 * `toScreen` converts a stored (PDF-native) point to current screen coordinates,
 * so the threshold stays constant regardless of zoom level.
 */
export function findSnapCandidate(
  cursorScreen: Point,
  candidates: SnapCandidate[],
  toScreen: (p: Point) => Point,
  thresholdPx: number,
): SnapCandidate | null {
  let best: SnapCandidate | null = null;
  let bestDist = thresholdPx;
  for (const candidate of candidates) {
    const screenPoint = toScreen(candidate.point);
    const d = distance(cursorScreen, screenPoint);
    if (d <= bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}

export function pointsEqual(a: Point, b: Point, epsilon = 1e-6): boolean {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}

/** Builds vertex + edge-midpoint snap candidates from all visible, unlocked-or-locked annotations (locked shapes are still valid snap targets). */
export function buildSnapCandidates(annotations: Annotation[], excludeId?: string): SnapCandidate[] {
  const candidates: SnapCandidate[] = [];
  for (const annotation of annotations) {
    if (annotation.id === excludeId || !annotation.visible) continue;
    for (const point of annotation.points) {
      candidates.push({ point, kind: annotation.type === 'line' ? 'endpoint' : 'vertex' });
    }
    if (annotation.points.length >= 2) {
      const segmentCount = annotation.type === 'line' ? annotation.points.length - 1 : annotation.points.length;
      for (let i = 0; i < segmentCount; i++) {
        const a = annotation.points[i];
        const b = annotation.points[(i + 1) % annotation.points.length];
        candidates.push({ point: midpoint(a, b), kind: 'midpoint' });
      }
    }
  }
  return candidates;
}
