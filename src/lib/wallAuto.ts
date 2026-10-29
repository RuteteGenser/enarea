import type { Annotation, Point } from '@/types';

/** Largest gap between two rooms' outlines (a wall's thickness) that still counts as "next to each other". */
export const ADJACENT_GAP_METERS = 0.5;

/** A side counts as shared when at least this share of its length lies along a neighbour's side. */
const SHARED_FRACTION = 0.5;

/** Length of the part of segment a1-a2 that lies alongside segment b1-b2 (parallel and within `gap`). */
function overlapAlong(a1: Point, a2: Point, b1: Point, b2: Point, gap: number): number {
  const dx = a2.x - a1.x;
  const dy = a2.y - a1.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  const ux = dx / len;
  const uy = dy / len;

  // Both ends of the other side must be within `gap` of this side's line.
  const offset = (p: Point) => Math.abs((p.x - a1.x) * uy - (p.y - a1.y) * ux);
  if (offset(b1) > gap || offset(b2) > gap) return 0;

  const t1 = (b1.x - a1.x) * ux + (b1.y - a1.y) * uy;
  const t2 = (b2.x - a1.x) * ux + (b2.y - a1.y) * uy;
  const from = Math.max(0, Math.min(t1, t2));
  const to = Math.min(len, Math.max(t1, t2));
  return Math.max(0, to - from);
}

/**
 * For each side of `target`: true when it faces the outside (no other area lies along it), false when
 * it is shared with a neighbouring area (an internal wall). `gap` is in the same units as the points.
 */
export function outerSides(target: Annotation, others: Annotation[], gap: number): boolean[] {
  const pts = target.points;
  const neighbourSides: [Point, Point][] = [];
  for (const other of others) {
    if (other.id === target.id || other.type === 'line') continue;
    other.points.forEach((p, i) => neighbourSides.push([p, other.points[(i + 1) % other.points.length]]));
  }

  return pts.map((a1, i) => {
    const a2 = pts[(i + 1) % pts.length];
    const len = Math.hypot(a2.x - a1.x, a2.y - a1.y);
    if (len === 0) return false;
    let covered = 0;
    for (const [b1, b2] of neighbourSides) covered += overlapAlong(a1, a2, b1, b2, gap);
    return covered < SHARED_FRACTION * len;
  });
}
