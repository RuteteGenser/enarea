import { useEffect, useRef, useState } from 'react';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, Point } from '@/types';

type BoxSelectOverlayProps = {
  zoom: number;
  width: number;
  height: number;
};

const CLICK_MOVE_THRESHOLD_PX = 4;

type Box = { x1: number; y1: number; x2: number; y2: number };

function boundsOf(annotation: Annotation): Box {
  const pts: Point[] = [...annotation.points, ...(annotation.regions ?? []).flat()];
  return {
    x1: Math.min(...pts.map((p) => p.x)),
    y1: Math.min(...pts.map((p) => p.y)),
    x2: Math.max(...pts.map((p) => p.x)),
    y2: Math.max(...pts.map((p) => p.y)),
  };
}

function intersects(a: Box, b: Box): boolean {
  return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;
}

/** Box-select tool: drag a dashed rectangle; everything it touches is selected (Shift adds to the current selection). */
export default function BoxSelectOverlay({ zoom, width, height }: BoxSelectOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const boxRef = useRef<Box | null>(null);
  const startClient = useRef<{ x: number; y: number } | null>(null);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);

  function toPdf(clientX: number, clientY: number): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  }

  useEffect(() => {
    if (!box) return;

    function onMove(e: MouseEvent) {
      const current = boxRef.current;
      if (!current) return;
      const p = toPdf(e.clientX, e.clientY);
      const next = { ...current, x2: p.x, y2: p.y };
      boxRef.current = next;
      setBox(next);
    }

    function onUp(e: MouseEvent) {
      const current = boxRef.current;
      const start = startClient.current;
      boxRef.current = null;
      startClient.current = null;
      setBox(null);
      if (!current || !start) return;
      const store = useAnnotationStore.getState();
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (moved < CLICK_MOVE_THRESHOLD_PX) {
        if (!e.shiftKey) store.setSelected(null); // a plain click on empty space clears the selection
        return;
      }
      const rect: Box = {
        x1: Math.min(current.x1, current.x2),
        y1: Math.min(current.y1, current.y2),
        x2: Math.max(current.x1, current.x2),
        y2: Math.max(current.y1, current.y2),
      };
      const hit = store.annotations
        .filter((a) => a.visible && !a.locked && intersects(boundsOf(a), rect))
        .map((a) => a.id);
      store.setSelectedMany(e.shiftKey ? [...new Set([...store.selectedIds, ...hit])] : hit);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      boxRef.current = null;
      startClient.current = null;
      setBox(null);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the listeners only need to exist while a box is being dragged
  }, [box !== null]);

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0"
      style={{ cursor: isSpaceDown ? undefined : 'crosshair' }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseDown={(e) => {
        if (e.button !== 0 || isSpaceDown) return;
        const p = toPdf(e.clientX, e.clientY);
        startClient.current = { x: e.clientX, y: e.clientY };
        boxRef.current = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
        setBox(boxRef.current);
      }}
    >
      {box && (
        <rect
          x={Math.min(box.x1, box.x2) * zoom}
          y={Math.min(box.y1, box.y2) * zoom}
          width={Math.abs(box.x2 - box.x1) * zoom}
          height={Math.abs(box.y2 - box.y1) * zoom}
          fill="#0091ff"
          fillOpacity={0.08}
          stroke="#0091ff"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
