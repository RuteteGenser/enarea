import type { Annotation, Orientation, Point } from '@/types';

/** Compass points in clockwise order from north, 45° apart. */
const COMPASS_ORDER: Orientation[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const ORIENTATION_NAMES: Record<Orientation, string> = {
  N: 'Nord',
  NE: 'Nordøst',
  E: 'Øst',
  SE: 'Sørøst',
  S: 'Sør',
  SW: 'Sørvest',
  W: 'Vest',
  NW: 'Nordvest',
};

/** Short Norwegian abbreviations (Ø = øst, V = vest). */
export const ORIENTATION_SHORT: Record<Orientation, string> = {
  N: 'N',
  NE: 'NØ',
  E: 'Ø',
  SE: 'SØ',
  S: 'S',
  SW: 'SV',
  W: 'V',
  NW: 'NV',
};

export const ORIENTATION_OPTIONS = COMPASS_ORDER;

/** Bearing in degrees of a compass point (N = 0, Ø = 90, S = 180, V = 270). */
export function orientationDegrees(o: Orientation): number {
  return COMPASS_ORDER.indexOf(o) * 45;
}

/** The nearest of the eight compass points for a bearing in degrees (0 = north, clockwise). */
export function compassPoint(bearing: number): Orientation {
  const index = Math.round((((bearing % 360) + 360) % 360) / 45) % 8;
  return COMPASS_ORDER[index];
}

/**
 * Bearing (degrees clockwise from true north) that the outside of a room's side faces. `north` is the
 * compass setting of the project: the angle on the drawing, clockwise from "up", where north points.
 */
export function outwardBearing(points: Point[], edgeIndex: number, north: number): number {
  const n = points.length;
  const a = points[edgeIndex];
  const b = points[(edgeIndex + 1) % n];

  // The winding decides which side of the edge is the outside.
  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    signedArea += p.x * q.y - q.x * p.y;
  }
  const sign = signedArea >= 0 ? 1 : -1;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = (sign * (b.y - a.y)) / len;
  const ny = (-sign * (b.x - a.x)) / len;

  const onPage = (Math.atan2(nx, -ny) * 180) / Math.PI; // clockwise from "up" on the drawing
  return (((onPage - north) % 360) + 360) % 360;
}

/**
 * Direction of an outer wall: a value set by hand wins, otherwise it follows the compass. Undefined
 * for sides that aren't marked as outer walls.
 */
export function wallOrientation(
  annotation: Pick<Annotation, 'points' | 'edges'>,
  edgeIndex: number,
  north: number,
): Orientation | undefined {
  const edge = annotation.edges?.[edgeIndex];
  if (edge?.wallType !== 'external') return undefined;
  return edge.orientation ?? compassPoint(outwardBearing(annotation.points, edgeIndex, north));
}

/**
 * Compass bearing in whole degrees (0–359, clockwise from north) that an outer wall faces: the
 * hand-set direction if there is one, otherwise computed from the compass. Undefined for non-outer sides.
 */
export function wallBearing(
  annotation: Pick<Annotation, 'points' | 'edges'>,
  edgeIndex: number,
  north: number,
): number | undefined {
  const edge = annotation.edges?.[edgeIndex];
  if (edge?.wallType !== 'external') return undefined;
  if (edge.orientation) return orientationDegrees(edge.orientation);
  return Math.round(outwardBearing(annotation.points, edgeIndex, north)) % 360;
}
