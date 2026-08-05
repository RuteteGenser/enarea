import { useEffect, useRef, useState, type RefObject } from 'react';
import { buildSnapCandidates } from '@/lib/geometry';
import { snapCursor } from '@/components/tools/useSnap';
import { useAnnotationStore } from '@/store/annotationStore';
import type { Annotation, Point } from '@/types';

type DragState =
  | { kind: 'vertex'; annotationId: string; index: number; originalPoints: Point[] }
  | { kind: 'body'; annotationId: string; originalPoints: Point[]; startPdf: Point };

export function useSelectTool(zoom: number, svgRef: RefObject<SVGSVGElement | null>) {
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const setSelected = useAnnotationStore((s) => s.setSelected);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [livePoints, setLivePoints] = useState<Point[] | null>(null);
  const livePointsRef = useRef<Point[] | null>(null);
  const dragRef = useRef<DragState | null>(null);

  function clientToPdf(clientX: number, clientY: number): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  }

  function startVertexDrag(annotation: Annotation, index: number, e: React.MouseEvent) {
    if (annotation.locked) return;
    e.stopPropagation();
    setSelected(annotation.id);
    const next: DragState = { kind: 'vertex', annotationId: annotation.id, index, originalPoints: annotation.points };
    dragRef.current = next;
    setDrag(next);
    livePointsRef.current = annotation.points;
    setLivePoints(annotation.points);
  }

  function startBodyDrag(annotation: Annotation, e: React.MouseEvent) {
    if (annotation.locked) return;
    e.stopPropagation();
    setSelected(annotation.id);
    const startPdf = clientToPdf(e.clientX, e.clientY);
    const next: DragState = { kind: 'body', annotationId: annotation.id, originalPoints: annotation.points, startPdf };
    dragRef.current = next;
    setDrag(next);
    livePointsRef.current = annotation.points;
    setLivePoints(annotation.points);
  }

  useEffect(() => {
    if (!drag) return;

    function onMove(e: MouseEvent) {
      const current = dragRef.current;
      if (!current) return;
      const cursorPdf = clientToPdf(e.clientX, e.clientY);

      let next: Point[];
      if (current.kind === 'vertex') {
        const allAnnotations = useAnnotationStore.getState().annotations;
        const candidates = buildSnapCandidates(allAnnotations, current.annotationId);
        const { point } = snapCursor(cursorPdf, candidates, zoom);
        next = [...current.originalPoints];
        next[current.index] = point;
      } else {
        const dx = cursorPdf.x - current.startPdf.x;
        const dy = cursorPdf.y - current.startPdf.y;
        next = current.originalPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      }
      livePointsRef.current = next;
      setLivePoints(next);
    }

    function finishDrag(commit: boolean) {
      const current = dragRef.current;
      if (current && commit && livePointsRef.current) {
        updateAnnotation(current.annotationId, { points: livePointsRef.current });
      }
      dragRef.current = null;
      setDrag(null);
      livePointsRef.current = null;
      setLivePoints(null);
    }

    function onUp() {
      finishDrag(true);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') finishDrag(false);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  function livePointsFor(annotationId: string): Point[] | null {
    return drag?.annotationId === annotationId ? livePoints : null;
  }

  function insertPoint(annotation: Annotation, edgeIndex: number, point: Point) {
    if (annotation.locked) return;
    const points = [...annotation.points];
    points.splice(edgeIndex + 1, 0, point);
    const edges = annotation.edges ? [...annotation.edges] : annotation.points.map(() => ({}));
    edges.splice(edgeIndex + 1, 0, {});
    updateAnnotation(annotation.id, { points, edges });
  }

  return {
    isDragging: drag !== null,
    livePointsFor,
    startVertexDrag,
    startBodyDrag,
    insertPoint,
  };
}
