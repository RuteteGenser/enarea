import { polygonArea, isPointInPolygon } from '@/lib/geometry';
import type { Point } from '@/types';

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Distance from a point to the nearest side of the polygon. */
function distanceToEdges(p: Point, ring: Point[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) best = Math.min(best, distanceToSegment(p, ring[i], ring[(i + 1) % ring.length]));
  return best;
}

const cache = new WeakMap<Point[], Point>();

/**
 * Where to put the label of an area: the point inside it that is furthest from every side (the middle of
 * the widest part), so the label box sits in the centre and not on an edge — also for L/U-shaped rooms
 * whose centroid would fall on or outside the edge. Found by sampling a grid and refining around the best.
 */
export function labelPoint(ring: Point[]): Point {
  const cached = cache.get(ring);
  if (cached) return cached;
  if (ring.length < 3) return ring[0] ?? { x: 0, y: 0 };

  const xs = ring.map((p) => p.x);
  const ys = ring.map((p) => p.y);
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);

  let best = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  let bestDist = isPointInPolygon(best, ring) ? distanceToEdges(best, ring) : -1;

  const N = 24;
  for (let round = 0; round < 4; round++) {
    const stepX = (x1 - x0) / N;
    const stepY = (y1 - y0) / N;
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        const p = { x: x0 + i * stepX, y: y0 + j * stepY };
        if (!isPointInPolygon(p, ring)) continue;
        const d = distanceToEdges(p, ring);
        if (d > bestDist) {
          bestDist = d;
          best = p;
        }
      }
    }
    // Refine: search the neighbourhood of the best point on a finer grid.
    const w = (x1 - x0) / 4;
    const h = (y1 - y0) / 4;
    x0 = best.x - w;
    x1 = best.x + w;
    y0 = best.y - h;
    y1 = best.y + h;
  }

  // Degenerate shapes (no interior point found): fall back to the average of the corners.
  if (bestDist < 0) best = { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: ys.reduce((a, b) => a + b, 0) / ys.length };
  cache.set(ring, best);
  return best;
}

/** Label point of the biggest ring of an area made of several (e.g. a room picked as several areas). */
export function areaLabelPoint(points: Point[], regions?: Point[][]): Point {
  const rings = [points, ...(regions ?? [])];
  const biggest = rings.reduce((a, b) => (polygonArea(b) > polygonArea(a) ? b : a), points);
  return labelPoint(biggest);
}
