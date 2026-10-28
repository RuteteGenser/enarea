import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { constrainAngle, distance, rectangleFromCorners } from '@/lib/geometry';
import { createId } from '@/lib/id';
import { useSnapCandidates, snapCursor } from '@/components/tools/useSnap';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, AnnotationType, Point, ToolId } from '@/types';

export const MIN_DRAG_PDF_UNITS = 2;

function buildAnnotation(type: AnnotationType, points: Point[], fileId: string): Annotation {
  const now = Date.now();
  return {
    id: createId(),
    fileId,
    type,
    points,
    edges: type !== 'line' ? points.map(() => ({})) : undefined,
    name: undefined,
    color: 'blue',
    locked: false,
    visible: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function useDrawTool(tool: ToolId, fileId: string, zoom: number) {
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);
  const snapCandidates = useSnapCandidates();

  const pointsRef = useRef<Point[]>([]);
  const [points, setPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [snapped, setSnapped] = useState<Point | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  // Line only: a plain click (no drag) sets the first point; the next click sets the last.
  const clickPendingRef = useRef(false);

  const isDrawTool = tool === 'line' || tool === 'rectangle' || tool === 'polygon';

  const resetDrawing = () => {
    pointsRef.current = [];
    setPoints([]);
    setDragStart(null);
    clickPendingRef.current = false;
    setCursor(null);
    setSnapped(null);
    useViewportStore.getState().setMagnifierScreenPos(null);
  };

  useEffect(() => {
    resetDrawing();
  }, [tool, fileId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') resetDrawing();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /** Line/polygon segments are constrained relative to the last placed point; rectangle isn't (no natural axis-lock there). */
  function getReferencePoint(): Point | null {
    if (tool === 'line') return dragStart;
    if (tool === 'polygon') {
      return pointsRef.current.length > 0 ? pointsRef.current[pointsRef.current.length - 1] : null;
    }
    return null;
  }

  function resolvePoint(e: ReactMouseEvent<SVGSVGElement>, referencePoint: Point | null = null): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };

    if (referencePoint && useViewportStore.getState().isShiftDown) {
      setSnapped(null);
      return constrainAngle(referencePoint, raw);
    }

    const { point, snappedTo } = snapCursor(raw, snapCandidates, zoom);
    setSnapped(snappedTo);
    return point;
  }

  function commit(type: AnnotationType, finalPoints: Point[]) {
    const annotation = buildAnnotation(type, finalPoints, fileId);
    addAnnotation(annotation);
  }

  function onMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!isDrawTool || useViewportStore.getState().isSpaceDown) return;
    useViewportStore
      .getState()
      .setMagnifierScreenPos(e.ctrlKey ? { x: e.clientX, y: e.clientY } : null);
    setCursor(resolvePoint(e, getReferencePoint()));
  }

  function onMouseDown(e: ReactMouseEvent<SVGSVGElement>) {
    // Holding space always means "pan" — leave dragStart unset so the container drags the view instead.
    // Middle button pans too, so it must not start a drag either.
    if ((tool !== 'rectangle' && tool !== 'line') || useViewportStore.getState().isSpaceDown || e.button === 1) return;
    if (tool === 'line' && clickPendingRef.current) return;
    const p = resolvePoint(e);
    setDragStart(p);
  }

  function onMouseUp(e: ReactMouseEvent<SVGSVGElement>) {
    if ((tool !== 'rectangle' && tool !== 'line') || !dragStart) return;
    const p = resolvePoint(e, getReferencePoint());
    if (distance(dragStart, p) >= MIN_DRAG_PDF_UNITS) {
      if (tool === 'rectangle') {
        commit('rectangle', rectangleFromCorners(dragStart, p));
      } else {
        commit('line', [dragStart, p]);
      }
    } else if (tool === 'line') {
      // Released without dragging: keep the start point and wait for the second click.
      clickPendingRef.current = true;
      return;
    }
    clickPendingRef.current = false;
    setDragStart(null);
  }

  function onClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (tool !== 'polygon') return;
    if (useViewportStore.getState().isSpaceDown) return;
    const p = resolvePoint(e, getReferencePoint());
    pointsRef.current = [...pointsRef.current, p];
    setPoints(pointsRef.current);
  }

  function onDoubleClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (tool !== 'polygon' || useViewportStore.getState().isSpaceDown) return;
    e.preventDefault();
    const finalPoints = pointsRef.current.slice(0, -1);
    if (finalPoints.length >= 3) {
      commit('polygon', finalPoints);
    }
    resetDrawing();
  }

  const dragPreviewPoints =
    tool === 'rectangle' && dragStart && cursor
      ? rectangleFromCorners(dragStart, cursor)
      : tool === 'line' && dragStart && cursor
        ? [dragStart, cursor]
        : null;

  return {
    isDrawTool,
    points,
    cursor,
    snapped,
    dragPreviewPoints,
    handlers: { onMouseMove, onMouseDown, onMouseUp, onClick, onDoubleClick },
  };
}
