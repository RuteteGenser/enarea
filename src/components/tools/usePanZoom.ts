import { useCallback, useRef, useState, type RefObject } from 'react';
import { useViewportStore } from '@/store/viewportStore';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

export function usePanZoom(containerRef: RefObject<HTMLDivElement | null>) {
  const tool = useViewportStore((s) => s.tool);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const setZoom = useViewportStore((s) => s.setZoom);

  const isPanMode = tool === 'pan' || isSpaceDown;
  const [isPanningActive, setIsPanningActive] = useState(false);
  const panState = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;
      e.preventDefault();

      const oldZoom = useViewportStore.getState().zoom;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;

      const rect = container.getBoundingClientRect();
      const cursorContentX = e.clientX - rect.left + container.scrollLeft;
      const cursorContentY = e.clientY - rect.top + container.scrollTop;
      const pdfX = cursorContentX / oldZoom;
      const pdfY = cursorContentY / oldZoom;

      setZoom(newZoom);

      requestAnimationFrame(() => {
        const el = containerRef.current;
        if (!el) return;
        el.scrollLeft = pdfX * newZoom - (e.clientX - rect.left);
        el.scrollTop = pdfY * newZoom - (e.clientY - rect.top);
      });
    },
    [containerRef, setZoom],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isPanMode || e.button !== 0) return;
      const container = containerRef.current;
      if (!container) return;
      panState.current = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: container.scrollLeft,
        scrollTop: container.scrollTop,
      };
      setIsPanningActive(true);
    },
    [isPanMode, containerRef],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!panState.current || !containerRef.current) return;
      const dx = e.clientX - panState.current.startX;
      const dy = e.clientY - panState.current.startY;
      containerRef.current.scrollLeft = panState.current.scrollLeft - dx;
      containerRef.current.scrollTop = panState.current.scrollTop - dy;
    },
    [containerRef],
  );

  const handleMouseUp = useCallback(() => {
    panState.current = null;
    setIsPanningActive(false);
  }, []);

  return { handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, isPanMode, isPanningActive };
}
