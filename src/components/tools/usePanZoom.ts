import { useCallback, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { useViewportStore } from '@/store/viewportStore';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

export type Pan = { x: number; y: number };

function applyTransform(pageEl: HTMLDivElement, pan: Pan) {
  // Panning/zooming must be instant; drop any leftover "jump" animation.
  pageEl.style.transition = '';
  pageEl.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
}

export function usePanZoom(pageRef: RefObject<HTMLDivElement | null>, panRef: RefObject<Pan>) {
  const tool = useViewportStore((s) => s.tool);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const setZoom = useViewportStore((s) => s.setZoom);

  const isPanMode = tool === 'pan' || isSpaceDown;
  const [isPanningActive, setIsPanningActive] = useState(false);
  const panState = useRef<{ startX: number; startY: number; pan: Pan } | null>(null);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const page = pageRef.current;
      if (!page) return;
      e.preventDefault();

      // Shift + scroll pans horizontally (some browsers already swap the delta onto deltaX).
      if (e.shiftKey) {
        const pan = panRef.current;
        pan.x -= e.deltaX || e.deltaY;
        applyTransform(page, pan);
        return;
      }

      const oldZoom = useViewportStore.getState().zoom;
      const factor = Math.exp(-e.deltaY * 0.0015);
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;

      // Measure the cursor's position relative to the actual rendered page —
      // this stays correct regardless of where the page is currently panned to.
      const pageRectBefore = page.getBoundingClientRect();
      const pdfX = (e.clientX - pageRectBefore.left) / oldZoom;
      const pdfY = (e.clientY - pageRectBefore.top) / oldZoom;

      // Force the re-render synchronously (rather than waiting a frame) so the page
      // element's new size is reflected in the DOM immediately below — otherwise
      // there's a visible frame where the page has resized but the compensating
      // pan hasn't landed yet, which reads as jitter during continuous zooming.
      flushSync(() => {
        setZoom(newZoom);
      });

      const pageRectAfter = page.getBoundingClientRect();
      const desiredLeft = e.clientX - pdfX * newZoom;
      const desiredTop = e.clientY - pdfY * newZoom;
      const pan = panRef.current;
      pan.x += desiredLeft - pageRectAfter.left;
      pan.y += desiredTop - pageRectAfter.top;
      applyTransform(page, pan);
    },
    [pageRef, panRef, setZoom],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const isMiddle = e.button === 1;
      if (!isMiddle && (!isPanMode || e.button !== 0)) return;
      // Stop the browser's middle-click autoscroll from taking over.
      if (isMiddle) e.preventDefault();
      panState.current = {
        startX: e.clientX,
        startY: e.clientY,
        pan: { ...panRef.current },
      };
      setIsPanningActive(true);
    },
    [isPanMode, panRef],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const state = panState.current;
      const page = pageRef.current;
      if (!state || !page) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      const pan = panRef.current;
      pan.x = state.pan.x + dx;
      pan.y = state.pan.y + dy;
      applyTransform(page, pan);
    },
    [pageRef, panRef],
  );

  const handleMouseUp = useCallback(() => {
    panState.current = null;
    setIsPanningActive(false);
  }, []);

  return { handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, isPanMode, isPanningActive };
}
