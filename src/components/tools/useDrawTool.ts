import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { distance, rectangleFromCorners } from '@/lib/geometry';
import { createId, defaultAnnotationName } from '@/lib/id';
import { useSnapCandidates, snapCursor } from '@/components/tools/useSnap';
import { useAnnotationStore } from '@/store/annotationStore';
import type { Annotation, AnnotationType, Point, ToolId } from '@/types';

const MIN_DRAG_PDF_UNITS = 2;

function buildAnnotation(type: AnnotationType, points: Point[], fileId: string, existing: Annotation[]): Annotation {
  const now = Date.now();
  return {
    id: createId(),
    fileId,
    type,
    points,
    edges: type !== 'line' ? points.map(() => ({})) : undefined,
    name: defaultAnnotationName(type, existing),
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

  const isDrawTool = tool === 'line' || tool === 'rectangle' || tool === 'polygon';

  const resetDrawing = () => {
    pointsRef.current = [];
    setPoints([]);
    setDragStart(null);
    setCursor(null);
    setSnapped(null);
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

  function resolvePoint(e: ReactMouseEvent<SVGSVGElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    const { point, snappedTo } = snapCursor(raw, snapCandidates, zoom);
    setSnapped(snappedTo);
    return point;
  }

  function commit(type: AnnotationType, finalPoints: Point[]) {
    const annotation = buildAnnotation(type, finalPoints, fileId, useAnnotationStore.getState().annotations);
    addAnnotation(annotation);
  }

  function onMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!isDrawTool) return;
    setCursor(resolvePoint(e));
  }

  function onMouseDown(e: ReactMouseEvent<SVGSVGElement>) {
    if (tool !== 'rectangle') return;
    const p = resolvePoint(e);
    setDragStart(p);
  }

  function onMouseUp(e: ReactMouseEvent<SVGSVGElement>) {
    if (tool !== 'rectangle' || !dragStart) return;
    const p = resolvePoint(e);
    if (distance(dragStart, p) >= MIN_DRAG_PDF_UNITS) {
      commit('rectangle', rectangleFromCorners(dragStart, p));
    }
    setDragStart(null);
  }

  function onClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (tool !== 'line' && tool !== 'polygon') return;
    const p = resolvePoint(e);
    if (tool === 'line') {
      pointsRef.current = [...pointsRef.current, p];
      setPoints(pointsRef.current);
      if (pointsRef.current.length === 2) {
        commit('line', pointsRef.current);
        resetDrawing();
      }
    } else if (tool === 'polygon') {
      pointsRef.current = [...pointsRef.current, p];
      setPoints(pointsRef.current);
    }
  }

  function onDoubleClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (tool !== 'polygon') return;
    e.preventDefault();
    const finalPoints = pointsRef.current.slice(0, -1);
    if (finalPoints.length >= 3) {
      commit('polygon', finalPoints);
    }
    resetDrawing();
  }

  const dragPreviewPoints = tool === 'rectangle' && dragStart && cursor ? rectangleFromCorners(dragStart, cursor) : null;

  return {
    isDrawTool,
    points,
    cursor,
    snapped,
    dragPreviewPoints,
    handlers: { onMouseMove, onMouseDown, onMouseUp, onClick, onDoubleClick },
  };
}
