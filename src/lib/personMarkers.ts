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

export function movePersonMarkers(markers: PersonMarker[] | undefined, dx: number, dy: number, newId: () => string): PersonMarker[] | undefined {
  return markers?.map((m) => ({ id: newId(), x: m.x + dx, y: m.y + dy }));
}
