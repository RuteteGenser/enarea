import { useMemo } from 'react';
import { buildSnapCandidates, distance, findSnapCandidate, type SnapCandidate } from '@/lib/geometry';
import { useAnnotationStore } from '@/store/annotationStore';
import type { Point } from '@/types';

const SNAP_THRESHOLD_PX = 10;

export function useSnapCandidates(excludeId?: string): SnapCandidate[] {
  const annotations = useAnnotationStore((s) => s.annotations);
  return useMemo(() => buildSnapCandidates(annotations, excludeId), [annotations, excludeId]);
}

export type SnapResult = { point: Point; snappedTo: Point | null };

/** Snaps a cursor point (in PDF-space) to the nearest candidate within the pixel threshold at the current zoom. */
export function snapCursor(
  cursorPdf: Point,
  candidates: SnapCandidate[],
  zoom: number,
  extraCandidates: SnapCandidate[] = [],
): SnapResult {
  const toScreen = (p: Point) => ({ x: p.x * zoom, y: p.y * zoom });
  const cursorScreen = toScreen(cursorPdf);
  const all = extraCandidates.length > 0 ? [...candidates, ...extraCandidates] : candidates;
  const match = findSnapCandidate(cursorScreen, all, toScreen, SNAP_THRESHOLD_PX);
  if (match) return { point: match.point, snappedTo: match.point };
  return { point: cursorPdf, snappedTo: null };
}

export function distancePx(a: Point, b: Point, zoom: number): number {
  return distance(a, b) * zoom;
}
