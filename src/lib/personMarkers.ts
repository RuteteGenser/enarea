import { annotationArea, isPointInPolygon } from '@/lib/geometry';
import type { Annotation, PersonMarker, Point } from '@/types';

/** The smallest visible area containing the point (so a room inside a bigger one wins); lines never count. */
export function areaAtPoint(annotations: Annotation[], point: Point): Annotation | undefined {
  return annotations
    .filter((a) => a.type !== 'line' && a.visible)
    .filter((a) => [a.points, ...(a.regions ?? [])].some((ring) => isPointInPolygon(point, ring)))
    .sort((a, b) => annotationArea(a) - annotationArea(b))[0];
}

/** Patch that adds a person icon at `point` to the area and counts it in the area's people. */
export function withPersonAdded(area: Annotation, point: Point, id: string): Pick<Annotation, 'personMarkers' | 'people'> {
  return {
    personMarkers: [...(area.personMarkers ?? []), { id, x: point.x, y: point.y }],
    people: (area.people ?? 0) + 1,
  };
}

/** Patch that removes a person icon from the area and takes it out of the area's people count. */
export function withPersonRemoved(area: Annotation, markerId: string): Pick<Annotation, 'personMarkers' | 'people'> {
  const markers = (area.personMarkers ?? []).filter((m) => m.id !== markerId);
  const people = Math.max(0, (area.people ?? 0) - 1);
  return { personMarkers: markers.length > 0 ? markers : undefined, people: people > 0 ? people : undefined };
}

/** Keeps at most `count` person icons (the earliest placed); undefined when none are left. */
export function trimPersonMarkers(markers: PersonMarker[] | undefined, count: number): PersonMarker[] | undefined {
  if (!markers) return undefined;
  const kept = markers.slice(0, Math.max(0, count));
  return kept.length > 0 ? kept : undefined;
}

export function movePersonMarkers(markers: PersonMarker[] | undefined, dx: number, dy: number, newId: () => string): PersonMarker[] | undefined {
  return markers?.map((m) => ({ id: newId(), x: m.x + dx, y: m.y + dy }));
}

function polygonCentroid(points: Point[]): Point {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** A point inside the area near its middle: the centroid, or for odd shapes the middle of the widest span through it. */
export function interiorPoint(area: Pick<Annotation, 'points' | 'regions'>): Point {
  const rings = [area.points, ...(area.regions ?? [])];
  const centroid = polygonCentroid(area.points);
  if (rings.some((r) => isPointInPolygon(centroid, r))) return centroid;

  // Centroid fell outside (L/U shapes): take the widest stretch of the horizontal line through it.
  const xs: number[] = [];
  const ring = area.points;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    if ((p.y <= centroid.y && q.y > centroid.y) || (q.y <= centroid.y && p.y > centroid.y)) {
      xs.push(p.x + ((centroid.y - p.y) / (q.y - p.y)) * (q.x - p.x));
    }
  }
  xs.sort((a, b) => a - b);
  let best = { from: ring[0].x, to: ring[0].x };
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > best.to - best.from) best = { from: xs[i], to: xs[i + 1] };
  return best.to > best.from ? { x: (best.from + best.to) / 2, y: centroid.y } : ring[0];
}

/** Offsets (in spacing units) around the middle where successive people are put so they don't sit on top of each other. */
const CLUSTER: [number, number][] = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1],
  [2, 0], [-2, 0], [0, 2], [0, -2], [2, 1], [-2, -1], [2, -1], [-2, 1], [1, 2], [-1, -2], [1, -2], [-1, 2],
];

/**
 * Person icons for `count` people in the area: existing ones are kept (extra ones removed from the end),
 * and missing ones are added in a small cluster around the middle of the area, inside it.
 */
export function markersForPeople(
  area: Pick<Annotation, 'points' | 'regions' | 'personMarkers'>,
  count: number,
  spacing: number,
  newId: () => string,
): PersonMarker[] | undefined {
  const existing = trimPersonMarkers(area.personMarkers, count) ?? [];
  if (existing.length >= count) return existing.length > 0 ? existing : undefined;

  const middle = interiorPoint(area);
  const rings = [area.points, ...(area.regions ?? [])];
  const out = [...existing];
  let slot = 0;
  while (out.length < count) {
    const [ox, oy] = CLUSTER[slot % CLUSTER.length];
    const ring = Math.floor(slot / CLUSTER.length); // beyond the first cluster, step further out
    const scale = spacing * (1 + ring * 0.5);
    const p = { x: middle.x + ox * scale, y: middle.y + oy * scale };
    slot++;
    const taken = out.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < spacing * 0.5);
    const inside = rings.some((r) => isPointInPolygon(p, r));
    if (!taken && (inside || slot > 400)) out.push({ id: newId(), x: inside ? p.x : middle.x, y: inside ? p.y : middle.y });
  }
  return out;
}
