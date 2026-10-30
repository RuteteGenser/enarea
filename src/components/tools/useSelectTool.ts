import { useDrawingInProgress } from '@/components/tools/useDrawingInProgress';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { buildSnapCandidates, constrainAngle, distance } from '@/lib/geometry';
import { snapCursor } from '@/components/tools/useSnap';
import { splitWall } from '@/lib/splitWall';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, Point } from '@/types';

const CLICK_MOVE_THRESHOLD_PX = 4;

type DragState = {
  annotationId: string;
  index: number;
  originalPoints: Point[];
  startClientX: number;
  startClientY: number;
};

export function useSelectTool(zoom: number, svgRef: RefObject<SVGSVGElement | null>) {
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const setSelected = useAnnotationStore((s) => s.setSelected);

  const [drag, setDrag] = useState<DragState | null>(null);
  // A clicked corner is "armed" (shown as a red X); clicking it again deletes it.
  const [armedVertex, setArmedVertex] = useState<{ annotationId: string; index: number } | null>(null);
  const [livePoints, setLivePoints] = useState<Point[] | null>(null);
  useDrawingInProgress(drag !== null);
  const livePointsRef = useRef<Point[] | null>(null);
  const armedVertexRef = useRef(armedVertex);
  armedVertexRef.current = armedVertex;
  const dragRef = useRef<DragState | null>(null);

  function clientToPdf(clientX: number, clientY: number): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  }

  function startVertexDrag(annotation: Annotation, index: number, e: React.MouseEvent) {
    if (annotation.locked) return;
    // Holding space always means "pan" — let the event bubble to the container so it can drag the view instead.
    if (useViewportStore.getState().isSpaceDown) return;
    e.stopPropagation();
    setSelected(annotation.id);
    const next: DragState = {
      annotationId: annotation.id,
      index,
      originalPoints: annotation.points,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
    dragRef.current = next;
    setDrag(next);
    livePointsRef.current = annotation.points;
    setLivePoints(annotation.points);
  }

  /** Removes a vertex (Shift+click on a handle, with no drag). Refuses to go below the minimum for the shape type. */
  function deleteVertex(annotationId: string, index: number) {
    const annotation = useAnnotationStore.getState().annotations.find((a) => a.id === annotationId);
    if (!annotation) return;
    const minPoints = annotation.type === 'line' ? 2 : 3;
    if (annotation.points.length <= minPoints) return;
    const points = annotation.points.filter((_, i) => i !== index);
    const edges = annotation.edges ? annotation.edges.filter((_, i) => i !== index) : undefined;
    updateAnnotation(annotationId, { points, edges });
  }

  function canDeleteVertexOf(annotationId: string): boolean {
    const annotation = useAnnotationStore.getState().annotations.find((a) => a.id === annotationId);
    if (!annotation) return false;
    return annotation.points.length > (annotation.type === 'line' ? 2 : 3);
  }

  // Clicking anywhere else (a vertex handle stops propagation before this) or pressing Escape disarms.
  useEffect(() => {
    if (!armedVertex) return;
    const disarm = () => setArmedVertex(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') disarm();
    };
    window.addEventListener('mousedown', disarm);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', disarm);
      window.removeEventListener('keydown', onKey);
    };
  }, [armedVertex]);

  useEffect(() => {
    if (!drag) return;

    function onMove(e: MouseEvent) {
      const current = dragRef.current;
      if (!current) return;
      useViewportStore
        .getState()
        .setMagnifierScreenPos(useViewportStore.getState().isMagnifierKeyDown ? { x: e.clientX, y: e.clientY } : null);
      const cursorPdf = clientToPdf(e.clientX, e.clientY);
      const originalVertex = current.originalPoints[current.index];

      let point: Point;
      if (useViewportStore.getState().isShiftDown) {
        point = constrainAngle(originalVertex, cursorPdf);
      } else {
        const allAnnotations = useAnnotationStore.getState().annotations;
        const candidates = buildSnapCandidates(allAnnotations, current.annotationId);
        point = snapCursor(cursorPdf, candidates, zoom).point;
      }

      const next = [...current.originalPoints];
      next[current.index] = point;

      livePointsRef.current = next;
      setLivePoints(next);
    }

    function reset() {
      dragRef.current = null;
      setDrag(null);
      livePointsRef.current = null;
      setLivePoints(null);
      useViewportStore.getState().setMagnifierScreenPos(null);
    }

    function finishDrag(commit: boolean) {
      const current = dragRef.current;
      if (current && commit && livePointsRef.current) {
        updateAnnotation(current.annotationId, { points: livePointsRef.current });
      }
      reset();
    }

    function onUp(e: MouseEvent) {
      const current = dragRef.current;
      if (current) {
        const moved = distance(
          { x: current.startClientX, y: current.startClientY },
          { x: e.clientX, y: e.clientY },
        );
        const isClick = moved < CLICK_MOVE_THRESHOLD_PX;
        if (isClick && useViewportStore.getState().isShiftDown) {
          deleteVertex(current.annotationId, current.index);
          setArmedVertex(null);
          reset();
          return;
        }
        if (isClick) {
          const armed = armedVertexRef.current;
          if (armed && armed.annotationId === current.annotationId && armed.index === current.index) {
            deleteVertex(current.annotationId, current.index);
            setArmedVertex(null);
          } else if (canDeleteVertexOf(current.annotationId)) {
            setArmedVertex({ annotationId: current.annotationId, index: current.index });
          }
          reset();
          return;
        }
        setArmedVertex(null);
      }
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

  /** Adds a corner in the middle of a side; both halves keep the side's wall marking. */
  function insertPoint(annotation: Annotation, edgeIndex: number) {
    splitWall(annotation.id, edgeIndex);
  }

  return {
    isDragging: drag !== null,
    armedVertex,
    livePointsFor,
    startVertexDrag,
    insertPoint,
  };
}
