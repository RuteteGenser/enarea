import { distance } from '@/lib/geometry';
import type {
  Annotation,
  BuildingComponentType,
  OpeningItem,
  OpeningKind,
  OpeningPlacement,
  PlacedOpening,
  Point,
} from '@/types';

export const OPENING_KIND_LABELS: Record<OpeningKind, string> = { vindu: 'Vindu', dor: 'Dør' };

/** Depth of the drawn rectangle across the wall, in meters. */
export const OPENING_DEPTH_METERS = 0.25;

/** Next free running number over all windows and doors, so names read Vindu 1, Vindu 2, Dør 3 … */
export function nextOpeningName(items: OpeningItem[], kind: OpeningKind): string {
  let max = 0;
  for (const item of items) {
    const match = item.name.match(/(\d+)\s*$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${OPENING_KIND_LABELS[kind]} ${Math.max(max, items.length) + 1}`;
}

/** Area in m² from the size in mm; undefined until both sizes are set. */
export function openingArea(item: { widthMm?: number; heightMm?: number }): number | undefined {
  if (!item.widthMm || !item.heightMm) return undefined;
  return (item.widthMm / 1000) * (item.heightMm / 1000);
}

/** Which building-component categories an opening can pick its type from. */
export function typeCategoryFor(kind: OpeningKind): BuildingComponentType['category'] {
  return kind === 'vindu' ? 'vindu' : 'ytterdor';
}

type Placed = { corners: Point[]; center: Point };

/** The rectangle of an opening on a room side: `width` along the wall, `depth` across it (PDF units). */
export function openingRect(a: Point, b: Point, t: number, width: number, depth: number): Placed {
  const len = distance(a, b) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const nx = -uy;
  const ny = ux;
  const center = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const hw = width / 2;
  const hd = depth / 2;
  const corner = (sx: number, sy: number) => ({
    x: center.x + ux * hw * sx + nx * hd * sy,
    y: center.y + uy * hw * sx + ny * hd * sy,
  });
  return { center, corners: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)] };
}

export type EdgeHit = { annotationId: string; edgeIndex: number; t: number; distance: number };

/** The room side closest to `point` (within `maxDistance`), with the position along it, kept inside the side if the opening fits. */
export function nearestEdge(
  point: Point,
  rooms: Annotation[],
  maxDistance: number,
  openingWidth: number,
): EdgeHit | null {
  let best: EdgeHit | null = null;
  for (const room of rooms) {
    if (room.type === 'line') continue;
    room.points.forEach((a, i) => {
      const b = room.points[(i + 1) % room.points.length];
      const len = distance(a, b);
      if (len === 0) return;
      const raw = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / (len * len);
      const half = Math.min(0.5, openingWidth / 2 / len);
      const t = Math.min(1 - half, Math.max(half, raw));
      const proj = { x: a.x + (b.x - a.x) * Math.min(1, Math.max(0, raw)), y: a.y + (b.y - a.y) * Math.min(1, Math.max(0, raw)) };
      const d = distance(point, proj);
      if (d <= maxDistance && (!best || d < best.distance)) best = { annotationId: room.id, edgeIndex: i, t, distance: d };
    });
  }
  return best;
}

/** Default width used for drawing/placing an opening whose width isn't filled in yet. */
export const DEFAULT_OPENING_WIDTH_MM = 1000;

/** Rectangle of a placed opening in PDF units, or null when it isn't placed or its room/side is gone. */
export function placedOpeningRect(item: OpeningItem, annotations: Annotation[], metersPerUnit: number): Placed | null {
  const place = item.placement;
  if (!place) return null;
  const room = annotations.find((a) => a.id === place.annotationId);
  const a = room?.points[place.edgeIndex];
  const b = room?.points[(place.edgeIndex + 1) % (room?.points.length ?? 1)];
  if (!room || !a || !b) return null;
  const width = ((item.widthMm ?? DEFAULT_OPENING_WIDTH_MM) / 1000) / metersPerUnit;
  return openingRect(a, b, place.t, width, OPENING_DEPTH_METERS / metersPerUnit);
}

/** A window/door type joined with one of its placements — what the drawing, Målinger and Excel work with. */
export type JoinedOpening = OpeningItem & { openingId: string; placement: OpeningPlacement };

/** One entry per placement (id = the placement's id), carrying the type's name, size and building type. */
export function joinPlacements(defs: OpeningItem[], placed: PlacedOpening[]): JoinedOpening[] {
  const joined: JoinedOpening[] = [];
  for (const p of placed) {
    const def = defs.find((d) => d.id === p.openingId);
    if (!def) continue;
    joined.push({
      ...def,
      id: p.id,
      openingId: def.id,
      placement: { annotationId: p.annotationId, edgeIndex: p.edgeIndex, t: p.t },
    });
  }
  return joined;
}

/**
 * Brings older saves up to date: a type that carried its own placement becomes a type plus a placement,
 * and copies made by the earlier "place again" behaviour are folded back into their original type.
 * Idempotent.
 */
export function normalizeOpenings(
  defs: OpeningItem[] | undefined,
  placed: PlacedOpening[] | undefined,
): { openings: OpeningItem[]; placedOpenings: PlacedOpening[] } {
  const items = defs ?? [];
  const out: PlacedOpening[] = [...(placed ?? [])];
  const types: OpeningItem[] = [];
  for (const item of items) {
    const { placement, templateId, ...type } = item;
    const owner = templateId && items.some((i) => i.id === templateId) ? templateId : type.id;
    if (placement) out.push({ id: item.id, openingId: owner, ...placement });
    if (!templateId || owner === type.id) types.push(type);
  }
  return { openings: types, placedOpenings: out };
}
