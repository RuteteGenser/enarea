import { useAnnotationStore } from '@/store/annotationStore';
import { useFilesStore } from '@/store/filesStore';
import type { Annotation, EdgeMeta, PlacedOpening, Point } from '@/types';

/** Splits side `edgeIndex` in two at its midpoint; both halves keep the marking (wall type, material …) of the original. */
export function splitEdge(annotation: Pick<Annotation, 'points' | 'edges'>, edgeIndex: number): { points: Point[]; edges: EdgeMeta[] } {
  const { points } = annotation;
  const a = points[edgeIndex];
  const b = points[(edgeIndex + 1) % points.length];
  const edges: EdgeMeta[] = annotation.edges ? [...annotation.edges] : points.map(() => ({}));
  while (edges.length < points.length) edges.push({});
  const original = edges[edgeIndex];
  // Legacy per-wall window/door lists stay on the first half only, so their area isn't counted twice.
  const { openings: _openings, ...second } = original;
  void _openings;
  edges.splice(edgeIndex + 1, 0, second);
  const next = [...points];
  next.splice(edgeIndex + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return { points: next, edges };
}

/** Windows/doors keep their spot on the wall when a side is split in two (t = 0.5 is the split). */
export function splitPlacements(placed: PlacedOpening[], annotationId: string, edgeIndex: number): PlacedOpening[] {
  return placed.map((p) => {
    if (p.annotationId !== annotationId) return p;
    if (p.edgeIndex > edgeIndex) return { ...p, edgeIndex: p.edgeIndex + 1 };
    if (p.edgeIndex < edgeIndex) return p;
    return p.t < 0.5 ? { ...p, t: p.t * 2 } : { ...p, edgeIndex: edgeIndex + 1, t: (p.t - 0.5) * 2 };
  });
}

/** Splits a wall of an area so each half can be marked on its own. */
export function splitWall(annotationId: string, edgeIndex: number): void {
  const store = useAnnotationStore.getState();
  const annotation = store.annotations.find((a) => a.id === annotationId);
  if (!annotation || annotation.locked) return;
  const { points, edges } = splitEdge(annotation, edgeIndex);
  store.updateAnnotation(annotationId, { points, edges });

  const file = useFilesStore.getState().getFile(annotation.fileId);
  if (file?.placedOpenings?.some((p) => p.annotationId === annotationId)) {
    void useFilesStore.getState().setOpenings(file.id, file.openings ?? [], splitPlacements(file.placedOpenings, annotationId, edgeIndex));
  }
}
